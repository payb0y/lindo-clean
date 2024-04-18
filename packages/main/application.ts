import { GameContext, IPCEvents, RootStore, SaveCharacterImageArgs, LANGUAGE_KEYS } from '@lindo/shared'
import { app, ipcMain, Menu } from 'electron'
import crypto from 'crypto'
import express from 'express'
import getPort from 'get-port'
import { Server } from 'http'
import { AddressInfo } from 'net'
import { APP_PATH, CHARACTER_IMAGES_PATH, GAME_PATH } from './constants'
import fs from 'fs-extra'
// @vite-ignore
import originalFs from 'original-fs'
import { getAppMenu } from './menu'
import { runUpdater } from './updater'
import { GameWindow } from './windows'
import path, { join } from 'path'
import cors from 'cors'
import { I18n } from './utils'
import { logger, setupRendererLogger } from './logger'
import { Locales } from '@lindo/i18n'
import { platform } from 'os'

export class Application {
  private static _instance: Application
  private readonly _i18n: I18n
  private readonly _hash: string

  static async init(rootStore: RootStore) {
    if (Application._instance) {
      throw new Error('Application already initialized')
    }

    // generate a hash for the app for randomization
    let hash: string
    if (app.isPackaged) {
      const path = app.getAppPath()
      const fileBuffer = originalFs.readFileSync(path)
      const hashSum = crypto.createHash('sha256')
      hashSum.update(fileBuffer)
      hash = hashSum.digest('hex')
    } else {
      const hashSum = crypto.createHash('sha256')
      hashSum.update(app.name)
      hash = hashSum.digest('hex')
    }

    // create express server to serve game file
    const serveGameServer = express()
    serveGameServer.use(
      cors({
        origin: '*'
      })
    )
    serveGameServer.use('/game', express.static(GAME_PATH))
    serveGameServer.use('/renderer', express.static(join(__dirname, '../renderer/')))
    serveGameServer.use('/character-images', express.static(CHARACTER_IMAGES_PATH))
    serveGameServer.use('/changelog', express.static(APP_PATH + '/CHANGELOG.md'))
    const gameServerPort = await getPort({ port: 3000 })
    const gameServer: Server = serveGameServer.listen(gameServerPort)

    // set default language
    if (!rootStore.appStore._language) {
      const userLocal = app.getLocale()
      const userLang = userLocal.split('-')[0] as Locales
      console.log(userLang)
      if (LANGUAGE_KEYS.includes(userLang)) {
        rootStore.appStore.setLanguageKey(userLang)
      }
    }

    Application._instance = new Application(rootStore, gameServer, hash)
  }

  static get instance(): Application {
    if (!Application._instance) {
      throw new Error('Application not initialized')
    }
    return Application._instance
  }

  private _gWindows: Array<GameWindow> = []

  private constructor(private _rootStore: RootStore, private _gameServer: Server, hash: string) {
    this._i18n = new I18n(this._rootStore)
    this._hash = hash
  }

  async run() {
    // setup global IPC handlers
    this._setupIPCHandlers()

    // run updater
    await runUpdater(this._rootStore, this._i18n)

    // set the app menu
    this._setAppMenu()

    await this._initGameWindows()

    app.on('second-instance', () => {
      logger.debug('Application -> second-instance')
      if (this._gWindows.length) {
        // Focus on the main window if the user tried to open another
        if (this._gWindows[0].isMinimized()) this._gWindows[0].restore()
        this._gWindows[0].focus()
      }
    })

    app.on('activate', () => {
      logger.debug('Application -> activate')
      if (this._gWindows.length) {
        this._gWindows[0].focus()
      } else {
        this.createGameWindow()
      }
    })
  }

  private async _initGameWindows() {
    this.createGameWindow()
  }

  private _setAppMenu() {
    Menu.setApplicationMenu(getAppMenu(this._rootStore, this._i18n))
    logger.debug('Application -> _setAppMenu')
    this._i18n.on('localeChanged', () => {
      Menu.setApplicationMenu(getAppMenu(this._rootStore, this._i18n))
    })
  }

  async createGameWindow() {
    const index = this._gWindows.length
    logger.debug('Application -> _createGameWindow ' + index)
    const serverAddress: AddressInfo = this._gameServer.address() as AddressInfo
    const gWindow = await GameWindow.init({
      index,
      url: 'http://localhost:' + serverAddress.port + '/renderer/index.html',
      store: this._rootStore
    })
    logger.debug('Application -> _createGameWindow ' + index + ' -> created')
    gWindow.on('close', () => {
      this._gWindows.splice(this._gWindows.indexOf(gWindow), 1)
      if (this._gWindows.length === 0) {
        if (process.platform !== 'darwin') app.quit()
      }
    })
    this._gWindows.push(gWindow)
  }

  private _setupIPCHandlers() {
    // logger handler
    setupRendererLogger()

    // handlers
    ipcMain.handle(IPCEvents.GET_GAME_CONTEXT, (event) => {
      const serverAddress: AddressInfo = this._gameServer.address() as AddressInfo
      const gWindow = this._gWindows.find((gWindow) => gWindow.id === event.sender.id)
      const context: GameContext = {
        gameSrc: 'http://localhost:' + serverAddress.port + '/game/index.html?delayed=true',
        characterImagesSrc: 'http://localhost:' + serverAddress.port + '/character-images/',
        changeLogSrc: 'http://localhost:' + serverAddress.port + '/changelog',
        windowId: event.sender.id,
        hash: this._hash,
        platform: platform()
      }
      return JSON.stringify(context)
    })

    ipcMain.on(IPCEvents.RESET_STORE, () => {
      this._rootStore.reset()
    })

    ipcMain.on(IPCEvents.SAVE_CHARACTER_IMAGE, (event, { image, name }: SaveCharacterImageArgs) => {
      const base64Data = image.replace(/^data:image\/png;base64,/, '')
      fs.mkdirSync(CHARACTER_IMAGES_PATH, { recursive: true })
      fs.writeFile(path.join(CHARACTER_IMAGES_PATH, `${name}.png`), base64Data, 'base64', (err) => {
        logger.error(err)
      })
    })

    ipcMain.on(IPCEvents.TOGGLE_MAXIMIZE_WINDOW, (event) => {
      logger.debug('Application -> TOGGLE_MAXIMIZE_WINDOW')
      const gWindow = this._gWindows.find((gWindow) => gWindow.id === event.sender.id)
      if (gWindow) {
        gWindow.toggleMaximize()
      }
    })

    ipcMain.on(IPCEvents.FOCUS_WINDOW, (event) => {
      logger.debug('Application -> FOCUS_WINDOW')
      const gWindow = this._gWindows.find((gWindow) => gWindow.id === event.sender.id)
      if (gWindow) {
        gWindow.focus()
      }
    })

    ipcMain.on(IPCEvents.AUDIO_MUTE_WINDOW, (event, value) => {
      logger.debug('Application -> AUDIO_MUTE_WINDOW')
      const gWindow = this._gWindows.find((gWindow) => gWindow.id === event.sender.id)
      if (gWindow) {
        gWindow.setAudioMute(value)
      }
    })
  }
}
