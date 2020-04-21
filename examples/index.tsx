import React from 'react'
import { render } from 'react-dom'
import { Text } from './text'
import { Button } from './button'
import { actions } from './actions'
import { useStoreSelector } from './store'

const onClick = () => {
  // you can safely update the store multiple times
  // setState will be called only once per tick
  for (let i = 0; i < 100; i++) {
    actions.updateKey('title', 'title_' + Math.random())
  }
  actions.addPhoto('dwight', 'http://new-photo')
}

const ConnectedText = () => {
  const props = useStoreSelector((state) => {
    const title = state.title
    const user = state.users.find(({ username }) => username === 'jim')
    const photos = state.photos.filter(({ username }) => username === 'jim')
    const userPhotos = photos?.map((photo) => ({ ...photo, user }))

    return {
      text: JSON.stringify({ title, photos: userPhotos }, null, 2),
      user,
      photos,
      onClick
    }
  })

  return <Text {...props} />
}

const ConnectedButton = () => {
  const props = {
    text: useStoreSelector((state) => state.button),
    users: useStoreSelector((state) =>
      state.users.find(({ username }) => username === 'jim')
    ),
    photos: useStoreSelector((state) =>
      state.users.find(({ username }) => username === 'jim')
    ),
    onClick: () => {
      actions.updateKey('button', 'button_' + Math.random())
      actions.addPhoto('jim', 'http://new-photo')
    }
  }

  return <Button {...props} />
}

const App = () => {
  return (
    <div>
      <ConnectedText />
      <ConnectedButton />
    </div>
  )
}

const rootElement = document.getElementById('root')
render(<App />, rootElement)
