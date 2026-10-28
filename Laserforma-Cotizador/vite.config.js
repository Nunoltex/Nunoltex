import { defineConfig } from 'vite';
export default defineConfig({base:'./',build:{sourcemap:false,assetsDir:'assets'},optimizeDeps:{entries:['index.html']},server:{watch:{ignored:['**/release*/**','**/.tmp/**','**/build/**']}}});
