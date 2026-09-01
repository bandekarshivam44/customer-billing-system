import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // Always light unless the user previously selected dark
    return localStorage.getItem("billing-theme") === "dark"
      ? "dark"
      : "light";
  });

  useEffect(() => {
    const root = document.documentElement;

    root.classList.toggle("dark", theme === "dark");

    localStorage.setItem("billing-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) =>
      current === "light" ? "dark" : "light"
    );
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}