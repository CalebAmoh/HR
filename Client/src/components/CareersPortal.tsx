import { useState, useEffect } from 'react';
import { CareersHome } from './CareersHome';
import { CareersJob } from './CareersJob';

function getPath() { return window.location.pathname; }

export function CareersPortal() {
  const [path, setPath] = useState(getPath);

  useEffect(() => {
    const handler = () => setPath(getPath());
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const navigate = (to: string) => {
    window.history.pushState(null, '', to);
    setPath(to);
  };

  const match = path.match(/^\/careers\/(.+)$/);
  if (match) {
    return <CareersJob code={match[1]} onBack={() => navigate('/careers')} />;
  }

  return <CareersHome onSelectJob={(code) => navigate(`/careers/${code}`)} />;
}
