const config = require(`./${process.argv[2]}`);
const queue = require('bull');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const storage = multer.memoryStorage();
const upload = multer({ storage });
const transliteration = require('transliteration');

let app = express();
const tasksQueue = queue(`${config.tasksQueue}`, config.redis);
const logFilepath = `${__dirname}/${config.logFileName}`;

app.use(express.static(`${__dirname}/public`));
app.use(express.static(`${__dirname}/${config.logsFolder}`));

app.listen(config.web.port, () => {
  console.log(`Web server started at port ${config.web.port}`);
});

app.get('/', (req, res) => {
  res.sendFile(`${__dirname}/private/index.html`);
});

app.post('/beginProcessing', upload.single('image'), (req, res) => {

  console.log('Got processing request:', req.body);

  if (!req.body.taskName || !req.body.communityToken || !(req.body.message || req.body.image)) {
    console.log('Bad params');
    res.sendStatus(400);
    return;
  }

  req.body.taskName = transliteration.transliterate(req.body.taskName);
  let stream = fs.createWriteStream(`${__dirname}/${config.logsFolder}/${req.body.taskName}.log`);
  stream.write(String("Рассылка добавлена в очередь. Ожидайте...") + '\n');

  tasksQueue.add(req.body);
  console.log('Job added to queue');
  res.redirect(`/${req.body.taskName}`);
});

app.get('/:logFilename', (req, res) => {
  res.sendFile(`${__dirname}/${config.logsFolder}/${req.params.logFilename}.log`);
});

app.all('/404', (req, res) => {
  res.send('404');
});
