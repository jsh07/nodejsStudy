// express 라이브러리 사용할 것임
const express = require('express')
const app = express()

// static 파일을 html에서 쓰고 싶을 때 해당 파일들이 들어 있는 폴더(public) 등록
app.use(express.static(__dirname + '/public'));

// ejs 세팅
app.set('view engine', 'ejs');

// DB 연결
const { MongoClient } = require('mongodb');

// 유저가 데이터 보냈을 때 꺼내쓰기 쉽게 세팅
app.use(express.json());
app.use(express.urlencoded({extended:true}))

let db;
const url = 'mongodb+srv://admin:qwer1234@lynx.fenevp1.mongodb.net/?retryWrites=true&w=majority';
new MongoClient(url).connect().then((client) => {
    console.log('DB연결성공');
    db = client.db('forum');

    // 서버 띄우는 코드
    // 8080: Port번호
    app.listen(8080, () => {
        console.log('http://localhost:8080 에서 서버 실행중');
    });

}).catch((err) => {
    console.log(err);
});


// __dirname : 현재 프로젝트의 절대 경로 (server.js 담긴 폴더)
app.get('/', (요청, 응답) => {
    응답.sendFile(__dirname + '/index.html');
});

app.get('/list', async (요청, 응답) => {
    // post 컬렉션의 모든 document 출력 - 외워
    let result = await db.collection('post').find().toArray();
    응답.render('list.ejs', {list: result});
});

app.get('/write', (요청, 응답) => {
    응답.render('write.ejs');
});
app.post('/add', (요청, 응답) => {
    
    
    // try문 안에 코드 실행하고 에러나면 catch문 실행
    try {
        // 데이터 검사
        // - 제목, 내용이 빈칸이면?
        // - 제목이 너무 길면?
        // - 제목에 특수기호 쓰면?..
        if (요청.body.title == '') {
            응답.send('제목입력해');
        } else {
    
            // insertOne 안의 데이터는 object로, db의 key 형식에 맞춰 넣어야 함
            const result = db.collection('post').insertOne(
             {
                 title : 요청.body.title,
                 content: 요청.body.content
             });
             응답.redirect('/list');
        }
        
    } catch(e){
        // 에러 원인
        console.log(e)
        // 에러 시 에러 코드 전송
        응답.status(500).send('서버에러남');
    }

});