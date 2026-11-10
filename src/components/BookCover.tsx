import type { CSSProperties } from "react";

interface BookCoverProps {
  title: string;
  author?: string;
  cover?: string;
  size?: "small" | "large";
}

export function BookCover({ title, author, cover, size = "small" }: BookCoverProps) {
  if (cover) {
    return (
      <div className={`book-cover book-cover--${size} book-cover--image`}>
        <img src={cover} alt={`${title}封面`} loading="lazy" />
      </div>
    );
  }

  const hue = [...title].reduce((total, char) => total + char.charCodeAt(0), 0) % 360;
  const style = {
    "--cover-hue": hue,
    "--cover-hue-2": (hue + 34) % 360,
  } as CSSProperties;

  return (
    <div className={`book-cover book-cover--${size} book-cover--generated`} style={style}>
      <span className="book-cover__mark">墨</span>
      <span className="book-cover__title">{title.slice(0, 12)}</span>
      {author ? <span className="book-cover__author">{author.slice(0, 10)}</span> : null}
    </div>
  );
}
