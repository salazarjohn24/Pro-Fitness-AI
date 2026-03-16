import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBase, getAuthHeaders, getFetchOptions } from "./useProfile";

export interface GymEnvironment {
  id: number;
  userId: string;
  name: string;
  type: string;
  equipment: Record<string, string[]>;
  isActive: boolean;
  createdAt: string;
}

export function useEnvironments() {
  return useQuery<GymEnvironment[]>({
    queryKey: ["environments"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/environments`, getFetchOptions(headers));
      if (!res.ok) throw new Error("Failed to load environments");
      return res.json();
    },
  });
}

export function useCreateEnvironment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; type: string; equipment: Record<string, string[]>; isActive?: boolean }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/environments`, {
        ...getFetchOptions(headers),
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create environment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["environments"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useUpdateEnvironment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name?: string; type?: string; equipment?: Record<string, string[]> }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/environments/${id}`, {
        ...getFetchOptions(headers),
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update environment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["environments"] });
    },
  });
}

export function useDeleteEnvironment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/environments/${id}`, {
        ...getFetchOptions(headers),
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete environment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["environments"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useActivateEnvironment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${getApiBase()}/api/environments/${id}/activate`, {
        ...getFetchOptions(headers),
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to activate environment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["environments"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
