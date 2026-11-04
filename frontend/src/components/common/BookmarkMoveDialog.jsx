import React from 'react';
import BookmarkActionDialog from './BookmarkActionDialog';
import Icon from './Icon';

export default function BookmarkMoveDialog({ folders, activeFolder, target, onSelect, count, pending, onCancel, onConfirm, message }) {
  return (
    <BookmarkActionDialog title="移动收藏" icon="drive_file_move"
      description={`为选中的 ${count} 篇收藏选择目标收藏夹。`} pending={pending} onCancel={onCancel}
      onConfirm={onConfirm} confirmDisabled={!target || !count}
      confirmText={pending ? '正在移动…' : `移动 ${count} 篇`} message={message}>
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="mb-3 text-sm font-semibold text-text-2">目标收藏夹</legend>
        <div className="grid max-h-[40vh] gap-2 overflow-y-auto p-1">
          {folders.map((folder) => {
            const current = activeFolder !== 'all' && folder.id === activeFolder;
            return (
              <label key={folder.id} className={`bookmark-folder-option flex min-w-0 items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${target === folder.id ? 'border-blue bg-blue-soft' : 'border-line bg-surface'} ${current || pending ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-blue/40'}`}>
                <input type="radio" name="bookmark-move-folder" value={folder.id} aria-label={`${folder.name}${current ? '（当前）' : ''}`}
                  checked={target === folder.id} disabled={pending || current} onChange={() => onSelect(folder.id)} />
                <Icon name={folder.id === 'all' ? 'bookmark' : 'folder'} className="shrink-0 text-blue" />
                <span className="min-w-0 flex-1 break-words text-sm font-semibold">{folder.name}</span>
                {current && <span className="shrink-0 text-xs text-text-3">当前</span>}
              </label>
            );
          })}
        </div>
      </fieldset>
      {target === 'all' && <p className="mt-3 mb-0 text-sm leading-relaxed text-text-2">移出自定义收藏夹，仍保留收藏。</p>}
    </BookmarkActionDialog>
  );
}
