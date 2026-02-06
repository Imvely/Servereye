import React from 'react';
import { Download } from 'lucide-react';
import Button from '../ui/Button';

interface ExportButtonProps {
  onClick: () => void;
  loading?: boolean;
  label?: string;
  className?: string;
}

const ExportButton: React.FC<ExportButtonProps> = ({
  onClick,
  loading = false,
  label = '내보내기',
  className = '',
}) => {
  return (
    <Button
      variant="secondary"
      size="md"
      icon={<Download size={16} />}
      onClick={onClick}
      disabled={loading}
      className={className}
    >
      {loading ? '다운로드 중...' : label}
    </Button>
  );
};

export default ExportButton;
