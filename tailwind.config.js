/** @type {import('tailwindcss').Config} */
module.exports = {
  // darkMode desactivado
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-dm-sans)'],
      },
      colors: {
        neutral: {
          100: '#F7F7F7',
          200: '#EBEBEB',
          300: '#DDDDDD',
          400: '#D3D3D3',
          500: '#808080',
          600: '#666666',
          700: '#4D4D4D',
        },
        border: '#EBEBEB',
        input: '#EBEBEB',
        ring: '#D3D3D3',
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#222222",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: '#F7F7F7',
          foreground: '#666666',
        },
        accent: {
          DEFAULT: '#F7F7F7',
          foreground: '#4D4D4D',
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}

