// express 라이브러리 사용할 것임
const express = require('express');
const app = express();

// method-override 사용
const methodOverride = require('method-override');
app.use(methodOverride('_method'));


// 환경변수 세팅
require('dotenv').config();

// static 파일을 html에서 쓰고 싶을 때 해당 파일들이 들어 있는 폴더(public) 등록
app.use(express.static(__dirname + '/public'));

// ejs 세팅
app.set('view engine', 'ejs');


// 유저가 데이터 보냈을 때 꺼내쓰기 쉽게 세팅
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


let db;
let connectDB = require('./database.js');
connectDB.then((client) => {
    console.log('DB연결성공');
    db = client.db('forum');

    // 서버 띄우는 코드
    // 8080: Port번호
    app.listen(process.env.PORT, () => {
        console.log('http://localhost:'+process.env.PORT+' 에서 서버 실행중');
    });

}).catch((err) => {
    console.log(err);
});


// 다른 파일로 분리한 페이지 import
// 관련 있는 API들은 URL을 비슷하게 만들어라

// CRUD
app.use('/', require('./routes/board.js'));

// __dirname : 현재 프로젝트의 절대 경로 (server.js 담긴 폴더)
app.get('/', (요청, 응답) => {
    // 응답.sendFile(__dirname + '/index.html');
    응답.render('login.ejs');
});



// 환경변수 : 개발자나 컴퓨터에 따라 달라져야 하는 변수
// 별도 파일에 보관해야 함
// - DB URL, 비밀번호, PORT 번호, 쿠키 유지 시간 등
// npm install dotenv
// .env 파일에 보관, 깃헙에 올리면 안됨


// API에 자주 출현하는 코드..
// 로그인했는지?
// middleware 사용
function middleware(요청, 응답, next) {
    // middleware 함수에선 요청, 응답 자유롭게 사용 가능
    // but 응답해버리면 남은 코드 실행 안 됨 
    next() // middleware 코드 끝나서 다음으로 이동하라는 뜻. 안 쓰면 무한대기
}

// 요청이 오면 먼저 실행됨
// - 함수를 따로 안 만들고 직접 넣어도 됨
// - []로 여러 개 넣기 가능
// - 너무 많으면 app.use() 사용
app.get('/url', middleware, (요청, 응답) => {
    // 1. middleware 실행
    // 2. 내부 코드 실행
});

// 여기 밑에 있는 모든 API는 이 middleware 적용됨
app.use(middleware);

// /URL 지정하면 /URL로 시작하는 모든 곳에 적용
// app.use('/URL', middleware);
