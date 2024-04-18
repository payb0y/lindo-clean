import { applySnapshot, SnapshotOut, types } from 'mobx-state-tree'
import { AppStore, AppStoreModel } from '../app-store'
/**
 * A RootStore model.
 */
export const RootStoreModel = types
  .model('RootStore')
  .props({
    appStore: types.optional(AppStoreModel, {})
  })
  .actions((self) => ({
    reset() {
      applySnapshot(self, {})
    }
  }))

/**
 * The RootStore instance.
 */
export interface RootStore {
  appStore: AppStore
  reset: () => void
}

/**
 * The data of a RootStore.
 */
export interface RootStoreSnapshot extends SnapshotOut<typeof RootStoreModel> {}
