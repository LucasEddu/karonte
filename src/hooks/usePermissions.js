import { useMemo } from 'react';
import { getProjectRole } from '../services/projectService';

export function usePermissions({ activeProjectId, projects, currentUserId }) {
  const activeProjectRole = useMemo(() => {
    if (!activeProjectId) return 'owner';
    const project = projects.find((p) => p.id === activeProjectId);
    return getProjectRole(project, currentUserId) || null;
  }, [projects, activeProjectId, currentUserId]);

  const canAddToProject =
    !activeProjectId ||
    activeProjectRole === 'owner' ||
    activeProjectRole === 'add' ||
    activeProjectRole === 'manage';

  const canDeleteInProject =
    !activeProjectId ||
    activeProjectRole === 'owner' ||
    activeProjectRole === 'manage';

  const canManageProject = activeProjectRole === 'owner';

  return {
    activeProjectRole,
    canAddToProject,
    canDeleteInProject,
    canManageProject,
  };
}
