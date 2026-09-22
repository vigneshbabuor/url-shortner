'use strict';

const { app } = require('./app');

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`linkpulse listening on http://localhost:${port}`));
}
