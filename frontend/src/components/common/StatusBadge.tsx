import React from 'react';
import { Wrench } from 'lucide-react';
import type { ServerStatus } from '../../types';
import { STATUS_COLORS, STATUS_LABELS } from '../../utils/constants';

interface StatusBadgeProps {
  status: ServerStatus;
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.unknown;
  const label = STATUS_LABELS[status] || status;
  const isCritical = status === 'critical';
  const isMaintenance = status === 'maintenance';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text} ${className}`}
    >
      {isMaintenance ? (
        <Wrench size={12} className="mr-1.5 shrink-0" />
      ) : (
        <span
          className={`w-2 h-2 rounded-full mr-1.5 shrink-0 ${colors.dot} ${
            isCritical ? 'animate-pulse' : ''
          }`}
        />
      )}
      {label}
    </span>
  );
};

export default StatusBadge;
