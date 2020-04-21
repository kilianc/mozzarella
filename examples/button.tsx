import * as React from "react";

let count = 1;

export const Button = ({
  text,
  onClick
}: {
  text: string;
  onClick: () => void;
}) => {
  console.info("<Button/> rerender " + count++);
  return <button onClick={onClick}>{text}</button>;
};
