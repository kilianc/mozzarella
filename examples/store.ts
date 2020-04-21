import { createStore } from '../create-store'

export type User = {
  username: string
}

export type Photo = {
  id: string
  username: string
  user?: User
  url: string
}

export type Album = {
  id: string
  username: string
  user?: User
  photosIds: string[]
  photos?: Photo[]
}

export type State = {
  title: string
  button: string
  users: User[]
  photos: Photo[]
  albums: Album[]
}

const store = createStore<State>({
  title: 'this is the title in store',
  button: 'this is the button in store',
  users: [
    {
      username: 'jim'
    },
    {
      username: 'pam'
    },
    {
      username: 'dwight'
    }
  ],
  photos: [
    {
      id: 'p-jim-01',
      username: 'jim',
      url: 'https://photo-jim-01'
    },
    {
      id: 'p-jim-02',
      username: 'jim',
      url: 'https://photo-jim-02'
    },
    {
      id: 'p-jim-03',
      username: 'jim',
      url: 'https://photo-jim-03'
    },
    {
      id: 'p-pam-01',
      username: 'pam',
      url: 'https://photo-pam-01'
    },
    {
      id: 'p-pam-02',
      username: 'pam',
      url: 'https://photo-pam-02'
    },
    {
      id: 'p-pam-03',
      username: 'pam',
      url: 'https://photo-pam-03'
    },
    {
      id: 'p-dwight-01',
      username: 'dwight',
      url: 'https://photo-dwight-01'
    },
    {
      id: 'p-dwight-02',
      username: 'dwight',
      url: 'https://photo-dwight-02'
    },
    {
      id: 'p-dwight-03',
      username: 'dwight',
      url: 'https://photo-dwight-03'
    }
  ],
  albums: [
    {
      id: 'a-jim',
      username: 'jim',
      photosIds: ['p-jim-01', 'p-jim-02', 'p-jim-03']
    },
    {
      id: 'a-pam',
      username: 'pam',
      photosIds: ['p-pam-01', 'p-pam-02', 'p-pam-03']
    },
    {
      id: 'a-dwight',
      username: 'dwight',
      photosIds: ['p-dwight-01', 'p-dwight-02', 'p-dwight-03']
    }
  ]
})

export const createAction = store.createAction
export const getState = store.getState
export const useStoreSelector = store.useStoreSelector
