import { createAction } from './store'

export const actions = {
  updateKey: createAction((state, key: 'title' | 'button', value: string) => {
    state[key] = value
  }),
  addPhoto: createAction((state, username: string, url: string) => {
    state.photos.push({ id: 'new-photo', username, url })
  })
}
