import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

export function RedirectMobile() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user && isMobile && location.pathname === "/") {
      navigate("/mobile", { replace: true });
    }
  }, [user, isMobile, location.pathname, navigate]);

  return null;
}
