/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        glass: {
          light: "rgba(255, 255, 255, 0.1)",
          medium: "rgba(255, 255, 255, 0.2)",
          heavy: "rgba(255, 255, 255, 0.4)",
          border: "rgba(255, 255, 255, 0.15)",
        },
        soma: {
          glow: "#38bdf8",
          dark: "#0f172a",
        }
      },
      backgroundImage: {
        'neural-mesh': "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')", // Placeholder for neural firing background
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      transitionTimingFunction: {
        'spring-gentle': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', // macOS style easing
      }
    },
  },
  plugins: [],
}
