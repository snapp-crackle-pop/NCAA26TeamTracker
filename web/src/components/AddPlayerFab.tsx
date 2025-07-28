'use client';

export default function AddPlayerFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      aria-label="Add Player"
      onClick={onClick}
      className="
        fixed left-4 bottom-4 md:left-6 md:bottom-6 z-[90]
        h-14 w-14 rounded-full
        bg-indigo-600 text-white text-3xl leading-none
        shadow-lg shadow-black/30
        hover:bg-indigo-500 active:scale-95 transition
      "
    >
      +
    </button>
  );
}