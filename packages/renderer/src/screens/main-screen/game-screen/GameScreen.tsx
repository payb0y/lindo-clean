import { useGameContext } from '@/providers'
import { useStores } from '@/store'
import { Game } from '@/store/game-store/game'
import { reaction } from 'mobx'
import { memo, useEffect, useRef } from 'react'

export interface GameScreenProps {
  game: Game
}

// eslint-disable-next-line react/display-name
export const GameScreen = memo(({ game }: GameScreenProps) => {
  const gameContext = useGameContext()
  const rootStore = useStores()
  const iframeGameRef = useRef<any>(null)

  useEffect(() => {
    return reaction(
      () => rootStore.gameStore.selectedGame,
      (selectedGame) => {
        if (selectedGame?.id === game.id) {
          setTimeout(() => {
            iframeGameRef.current?.focus()
          }, 100)
        }
      },
      { fireImmediately: true }
    )
  }, [])

  const handleLoad = () => {
    if (iframeGameRef.current) {
      const gameWindow = iframeGameRef.current.contentWindow

      // can't use SQL Database in modern iframe
      gameWindow.openDatabase = undefined
      gameWindow.initDofus(() => {
        window.lindoAPI.logger.info('initDofus done')()
      })
    }
  }

  return (
    <iframe
      id={`iframe-game-${game.id}`}
      ref={iframeGameRef}
      onLoad={handleLoad}
      style={{ border: 'none', width: '100%', height: '100%' }}
      src={gameContext.gameSrc}
    />
  )
})
