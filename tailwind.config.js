/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/views/*.ejs', // Asegúrate de incluir las vistas ejs
    './app/**/*.js', 
    './src/*.js'
  ],
  theme: {
    extend: {}, // Aquí puedes extender el tema de Tailwind si necesitas personalización
  },
  plugins: [], // Aquí puedes agregar otros plugins de Tailwind si es necesario
}
