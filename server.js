// express 라이브러리 사용할 것임
const express = require('express')
const app = express()

// 서버 띄우는 코드
// 8080: Port번호
app.listen(8080, ()=>{
    console.log('http://localhost:8080 에서 서버 실행중');
});

// __dirname : 현재 프로젝트의 절대 경로 (server.js 담긴 폴더)
app.get('/', (요청, 응답)=>{
    응답.sendFile(__dirname + '/index.html');
});

// 숙제
// 누가 /about 으로 접속하면 내 소개용 html 페이지를 보내주자.
app.get('/about', (요청, 응답)=>{
    응답.sendFile(__dirname + '/about.html');
});