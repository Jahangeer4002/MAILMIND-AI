import { Navigate, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "../services/api";
import { useAuthStore } from "../store";
import { useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

export default function AppLayout() {
  const { setUser, setLoading } = useAuthStore();

  const {
    data: currentUser,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await authApi.getMe();
      return res.data.user;
    },
    retry: false,
  });

  useEffect(() => {
    setLoading(isLoading);

    if (currentUser) {
      setUser(currentUser);
    } else if (isError) {
      setUser(null);
    }
  }, [currentUser, isLoading, isError, setUser, setLoading]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (isError || !currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
