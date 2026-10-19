import { handlers } from "@/auth";

// Route Handler que Auth.js necesita para el flujo de login/logout
// (architecture.md §8.1: toda escritura pasa por REST, nunca Server Actions).
export const { GET, POST } = handlers;
