Offline Excel reader: read-excel-file 9.3.12, `readSheet` from its universal entry (first sheet).
Bundled with esbuild 0.28.2, including fflate and saxen; their licenses are included here.
No worker, network request, dynamic eval or server dependency is required.

Rebuild in a temporary tool directory after installing read-excel-file@9.3.12 and esbuild:

```js
import { readSheet } from 'read-excel-file/universal';
window.DingdongReadExcel = input => readSheet(input, 1);
```

Bundle that entry with `esbuild entry.js --bundle --minify --format=iife --outfile=read-excel-file.js`.
