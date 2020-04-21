import React from 'react'
import { render } from 'react-dom'
import { createSelector } from 'reselect'
import { Text } from './examples/text'
import { Button } from './examples/button'
import { actions } from './examples/actions'
import { useStoreSelector } from './examples/store'

const onClick = () => {
  for (let i = 0; i < 100; i++) {
    // actions.updateKey('title', 'title_' + Math.random())
  }
  actions.addPhoto('dwight', 'http://new-photo')
}

const ConnectedText = () => {
  // you can safely update the store multiple times
  // setState will be called only once per tick

  // use reselect for complex objects
  // or any other memoization technique
  const props = useStoreSelector(
    createSelector(
      (state) => state.title,
      (state) => state.users.find(({ username }) => username === 'jim'),
      (state) => state.photos.filter(({ username }) => username === 'jim'),
      (title, user, photos) => {
        console.log('running')
        // photos?.map((photo) => ({ ...photo, user }))

        return {
          text: JSON.stringify({ title, photos }, null, 2),
          user,
          photos,
          onClick
        }
      }
    )
  )

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
    }
  }

  return <Button {...props} />
}

const App = () => {
  return (
    <div>
      <h1>test</h1>
      <ConnectedText />
      <ConnectedButton />
    </div>
  )
}

const rootElement = document.getElementById('root')
render(<App />, rootElement)
