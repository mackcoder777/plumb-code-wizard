import React from 'react';

interface SourceFileFilterProps {
  sourceFiles: string[];
  selectedFile: string | 'all';
  onSelectFile: (file: string | 'all') => void;
  itemCountByFile: Record<string, number>;
}

const SourceFileFilter: React.FC<SourceFileFilterProps> = ({
  sourceFiles,
  selectedFile,
  onSelectFile,
  itemCountByFile
}) => {
  if (sourceFiles.length <= 1) return null;

  const totalItems = Object.values(itemCountByFile).reduce((a, b) => a + b, 0);

  return (
    <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-xl border border-primary/20">
      <span className="text-sm font-medium text-primary">Source File:</span>
      
      <div className="flex flex-wrap gap-2">
        {/* All Files Option */}
        <button
          onClick={() => onSelectFile('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            selectedFile === 'all'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'bg-background text-primary border border-primary/30 hover:bg-primary/10'
          }`}
        >
          All Files
          <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs ${
            selectedFile === 'all' 
              ? 'bg-primary-foreground/20 text-primary-foreground' 
              : 'bg-primary/10 text-primary'
          }`}>
            {totalItems.toLocaleString()}
          </span>
        </button>

        {/* Individual File Options */}
        {sourceFiles.map((file, index) => {
          const count = itemCountByFile[file] || 0;
          const shortName = file.length > 25 
            ? file.substring(0, 22) + '...' 
            : file;
          
          return (
            <button
              key={file}
              onClick={() => onSelectFile(file)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                selectedFile === file
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-background text-primary border border-primary/30 hover:bg-primary/10'
              }`}
              title={file}
            >
              <span className="text-xs">
                {index === 0 ? '📄' : '📎'}
              </span>
              {shortName}
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                selectedFile === file 
                  ? 'bg-primary-foreground/20 text-primary-foreground' 
                  : 'bg-primary/10 text-primary'
              }`}>
                {count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SourceFileFilter;
