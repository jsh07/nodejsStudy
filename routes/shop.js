const router = require('express').Router();

let db;
let connectDB = require('./../database.js');
connectDB.then((client) => {
    db = client.db('forum');
}).catch((err) => {
    console.log(err);
});


router.get('/shirts', async (요청, 응답) => {
    let a = await db.collection('post').find().toArray();
    응답.send('셔츠파는 페이지');
});
router.get('/pants', (요청, 응답) => {
    응답.send('바지파는 페이지');
});

module.exports = router;