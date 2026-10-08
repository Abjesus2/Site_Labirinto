import React from 'react';
import { Handle } from '@xyflow/react';
import { getShapeGeometry } from '../utils/shapeGeometry';

// O "+" de cada ponto de conexão é desenhado só com CSS (::after do próprio
// Handle, ver index.css). Antes eram 2 elementos extras por ponto — 48 por
// forma, milhares num fluxo grande, o que deixava arrastar e rolar lento.
export const MultipleHandles: React.FC<{ type?: string }> = ({ type = 'process' }) => {
  const geom = getShapeGeometry(type);
  const connectionPoints = geom.getConnectionPoints();

  return (
    <>
      {connectionPoints.flatMap((pt) =>
        (['target', 'source'] as const).map((handleType) => (
          <Handle
            key={`${handleType}-${pt.id}`}
            id={pt.id}
            type={handleType}
            position={pt.position}
            className="multi-handle"
            style={{
              left: `${pt.x * 100}%`,
              top: `${pt.y * 100}%`,
              right: 'auto',
              bottom: 'auto',
              transform: 'translate(-50%, -50%)', // Use -50% to properly center on the point
            }}
          />
        ))
      )}
    </>
  );
};
