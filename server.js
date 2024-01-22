// express 라이브러리 사용할 것임
const express = require('express')
const app = express()

// 서버 띄우는 코드
// 8080: Port번호
app.listen(8080, ()=>{
    console.log('http://localhost:8080 에서 서버 실행중');
});

// 간단한 서버 기능
app.get('/', (요청, 응답)=>{
    응답.send('반갑다');
})