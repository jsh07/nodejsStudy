// express 라이브러리 사용할 것임
const express = require('express')
const app = express()

// static 파일을 html에서 쓰고 싶을 때 해당 파일들이 들어 있는 폴더(public) 등록
app.use(express.static(__dirname + '/public'));

// DB 연결
const { MongoClient} = require('mongodb');

let db;
const url = 'mongodb+srv://admin:qwer1234@lynx.fenevp1.mongodb.net/?retryWrites=true&w=majority';
new MongoClient(url).connect().then((client)=>{
    console.log('DB연결성공');
    db = client.db('forum');

    // 서버 띄우는 코드
    // 8080: Port번호
    app.listen(8080, ()=>{
        console.log('http://localhost:8080 에서 서버 실행중');
    });

}).catch((err)=>{
    console.log(err);
});





// __dirname : 현재 프로젝트의 절대 경로 (server.js 담긴 폴더)
app.get('/', (요청, 응답)=>{
    응답.sendFile(__dirname + '/index.html');
});
app.get('/insert', (요청, 응답)=>{
    db.collection('post').insertOne({title: '123'});
});