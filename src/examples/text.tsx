import * as React from 'react'

let count = 1

export const Text = ({
  text,
  onClick
}: {
  text: string
  onClick: () => void
}) => {
  console.info('<Text/> re-render ' + count++)
  return <pre onClick={onClick}>{text}</pre>
}
