import { detach, Instance, SnapshotOut, types } from 'mobx-state-tree'
import { withRootStore } from '@lindo/shared'
import { Game, GameModel } from './game'
import { v4 as uuidv4 } from 'uuid'

const GameCharacterModel = types.model('GameCharacter').props({
  id: types.optional(types.identifier, () => uuidv4()),
  account: types.string,
  password: types.string,
  name: types.string
})

/**
 * Un-comment the following to omit model attributes from your snapshots (and from async storage).
 * Useful for sensitive data like passwords, or transitive state like whether a modal is open.

 * Note that you'll need to import `omit` from ramda, which is already included in the project!
 *  .postProcessSnapshot(omit(["password", "socialSecurityNumber", "creditCardNumber"]))
 */

type GameCharacterType = Instance<typeof GameCharacterModel>

interface GameCharacter extends GameCharacterType {}
/**
 * Model description here for TypeScript hints.
 */
export const GameStoreModel = types
  .model('GameStore')
  .props({
    isMuted: types.optional(types.boolean, false),
    _games: types.map(GameModel),
    gamesOrder: types.array(types.safeReference(GameModel, { acceptsUndefined: false })),
    selectedGame: types.safeReference(GameModel)
  })
  .extend(withRootStore)
  .actions((self) => ({
    toggleMute() {
      self.isMuted = !self.isMuted
      window.lindoAPI.setAudioMuteWindow(self.isMuted)
    },
    addGame(character?: GameCharacter) {
      if (self._games.size > 5) {
        throw new Error('More than 6 game tabs are not supported')
      }
      const game = self._games.put({ character: character?.id })
      self.gamesOrder.push(game)
      self.selectedGame = game
    },
    removeGame(game: Game) {
      if (self.selectedGame === game) {
        detach(self.selectedGame)
        if (self._games.size > 0) {
          if (self.gamesOrder.indexOf(game) === self.gamesOrder.length - 1) {
            self.selectedGame = self.gamesOrder[self.gamesOrder.indexOf(game) - 1]
          } else {
            self.selectedGame = self.gamesOrder.reverse().find((g) => g !== game)
          }
        } else {
          self.selectedGame = undefined
        }
      }
      self._games.delete(game.id)
    },
    selectGame(game: Game) {
      if (self._games.has(game.id)) {
        self.selectedGame = game
        self.selectedGame.setHasNotification(false)
      }
    },
    selectGameIndex(index: number) {
      if (self.gamesOrder[index]) {
        self.selectedGame = self.gamesOrder[index]
        self.selectedGame.setHasNotification(false)
      }
    }
  }))
  .actions((self) => ({
    selectNextGame() {
      const index = self.gamesOrder.indexOf(self.selectedGame!)
      if (index >= self.gamesOrder.length - 1) {
        self.selectGameIndex(0)
        return
      }
      if (index !== -1) {
        self.selectGameIndex(index + 1)
      }
    },
    selectPreviousGame() {
      const index = self.gamesOrder.indexOf(self.selectedGame!)
      if (index === 0) {
        self.selectGameIndex(self.gamesOrder.length - 1)
        return
      }
      if (index !== -1) {
        self.selectGameIndex(index - 1)
      }
    },
    removeSelectedGame() {
      if (self.selectedGame) {
        self.removeGame(self.selectedGame)
      }
    },
    moveGame(srcGameId: string, targetGameId: string) {
      const srcGame = self._games.get(srcGameId)!
      const oldIndex = self.gamesOrder.indexOf(srcGame)
      const newIndex = self.gamesOrder.findIndex((g) => g.id === targetGameId)
      if (oldIndex !== -1) {
        self.gamesOrder.splice(oldIndex, 1)
      }
      self.gamesOrder.splice(newIndex, 0, srcGame)
    }
  }))
  .views((self) => ({
    /**
     * Get all games non ordonned.
     */
    get games() {
      return Array.from(self._games.values())
    }
  }))

/**
 * Un-comment the following to omit model attributes from your snapshots (and from async storage).
 * Useful for sensitive data like passwords, or transitive state like whether a modal is open.

 * Note that you'll need to import `omit` from ramda, which is already included in the project!
 *  .postProcessSnapshot(omit(["password", "socialSecurityNumber", "creditCardNumber"]))
 */

type GameStoreType = Instance<typeof GameStoreModel>

export interface GameStore extends GameStoreType {}

type GameStoreSnapshotType = SnapshotOut<typeof GameStoreModel>

export interface GameStoreSnapshot extends GameStoreSnapshotType {}
