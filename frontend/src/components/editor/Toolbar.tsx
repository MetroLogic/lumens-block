"use client"

const BLOCK_TYPES = ["Condition", "Transfer", "Storage", "Event", "Auth"]

export default function Toolbar() {
  const onDragStart = (event: React.DragEvent, blockType: string) => {
    event.dataTransfer.setData("application/blocktype", blockType)
  }

  return (
    <div className="absolute left-4 top-4 z-10 flex flex-col gap-2 rounded-lg border bg-white p-3 shadow-md">
      <p className="text-xs font-semibold text-gray-500 uppercase">Blocks</p>
      {BLOCK_TYPES.map((type) => (
        <div
          key={type}
          draggable
          onDragStart={(e) => onDragStart(e, type)}
          className="cursor-grab rounded border px-3 py-1.5 text-sm hover:bg-gray-50 active:cursor-grabbing"
        >
          {type}
        </div>
      ))}
    </div>
  )
}
