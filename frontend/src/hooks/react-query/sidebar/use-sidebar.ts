'use client';

import { createMutationHook } from "@/hooks/use-query";
import { getProjects, getThreads, Project, Thread } from "@/lib/api";
import { createQueryHook } from '@/hooks/use-query';
import { threadKeys } from "./keys";
import { projectKeys } from "./keys";
import { deleteThread } from "../threads/utils";

export const useProjects = createQueryHook(
  projectKeys.lists(),
  async () => {
    const data = await getProjects();
    return data as Project[];
  },
  {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  }
);

export const useThreads = createQueryHook(
  threadKeys.lists(),
  async () => {
    const data = await getThreads();
    return data as Thread[];
  },
  {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  }
);

interface DeleteThreadVariables {
  threadId: string;
  sandboxId?: string;
  isNavigateAway?: boolean;
}

export const useDeleteThread = createMutationHook(
  async ({ threadId, sandboxId }: DeleteThreadVariables) => {
    return await deleteThread(threadId, sandboxId);
  },
  {
    onSuccess: () => {
    },
  }
);

interface DeleteMultipleThreadsVariables {
  threadIds: string[];
  threadSandboxMap?: Record<string, string>;
  onProgress?: (completed: number, total: number) => void;
}

export const useDeleteMultipleThreads = createMutationHook(
  async ({ threadIds, threadSandboxMap, onProgress }: DeleteMultipleThreadsVariables) => {
    let completedCount = 0;
    const results = await Promise.all(
      threadIds.map(async (threadId) => {
        try {
          const sandboxId = threadSandboxMap?.[threadId];
          const result = await deleteThread(threadId, sandboxId);
          completedCount++;
          onProgress?.(completedCount, threadIds.length);
          return { success: true, threadId };
        } catch (error) {
          return { success: false, threadId, error };
        }
      })
    );
    
    return {
      successful: results.filter(r => r.success).map(r => r.threadId),
      failed: results.filter(r => !r.success).map(r => r.threadId),
    };
  },
  {
    onSuccess: () => {
    },
  }
);

export type ThreadWithProject = {
  threadId: string;
  projectId: string;
  projectName: string;
  url: string;
  updatedAt: string;
};

export const processThreadsWithProjects = (
  threads: Thread[],
  projects: Project[]
): ThreadWithProject[] => {
  const projectsById = new Map<string, Project>();
  projects.forEach((project) => {
    projectsById.set(project.id, project);
  });

  const threadsWithProjects: ThreadWithProject[] = [];

  for (const thread of threads) {
    const projectId = thread.project_id;
    if (!projectId) continue;

    const project = projectsById.get(projectId);
    if (!project) {
      continue;
    }
    let displayName = project.name || 'Unnamed Project';
    if (thread.metadata?.is_workflow_execution && thread.metadata?.workflow_run_name) {
      displayName = thread.metadata.workflow_run_name;
    }

    threadsWithProjects.push({
      threadId: thread.thread_id,
      projectId: projectId,
      projectName: displayName,
      url: `/projects/${projectId}/thread/${thread.thread_id}`,
      updatedAt:
        thread.updated_at || project.updated_at || new Date().toISOString(),
    });
  }

  return sortThreads(threadsWithProjects);
};

export const sortThreads = (
  threadsList: ThreadWithProject[],
): ThreadWithProject[] => {
  return [...threadsList].sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
};