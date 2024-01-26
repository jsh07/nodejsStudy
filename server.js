// express 라이브러리 사용할 것임
const express = require('express')
const app = express()
// DB 연결
const { MongoClient, ObjectId } = require('mongodb');

// method-override 사용
const methodOverride = require('method-override');
app.use(methodOverride('_method'));

// bcrypt 세팅
const bcrpyt = require('bcrypt');

// 환경변수 세팅
require('dotenv').config();

// static 파일을 html에서 쓰고 싶을 때 해당 파일들이 들어 있는 폴더(public) 등록
app.use(express.static(__dirname + '/public'));

// ejs 세팅
app.set('view engine', 'ejs');


// 유저가 데이터 보냈을 때 꺼내쓰기 쉽게 세팅
app.use(express.json());
app.use(express.urlencoded({ extended: true }))


// passport 라이브러리 세팅 (순서 중요)
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const MongoStore = require('connect-mongo'); // 세션데이터를 DB에 저장하기 위한 라이브러리

app.use(passport.initialize())
app.use(session({
    secret: '암호화에 쓸 비번', // 암호화할 때 쓸 비밀번호, 세션의 document id는 암호화해서 유저에게 보냄
    resave: false, // 유저가 서버로 요청할 때마다 세션 갱신할건지
    saveUninitialized: false, // 로그인 안 해도 세션을 만들 것인지
    cookie: { maxAge: 60 * 60 * 1000 }, // 세션 유지 시간 (단위 ms)
    store: MongoStore.create({
        mongoUrl: process.env.DB_URL,
        dbName: 'forum'
    })
}));

app.use(passport.session());

// AWS-S3 세팅
const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = new S3Client({
  region : 'ap-northeast-2',
  credentials : {
      accessKeyId : process.env.ACCESS_KEY,
      secretAccessKey : process.env.SECRET_ACCESS_KEY
  }
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'suheeforum1',
    key: function (요청, file, cb) {
      cb(null, Date.now().toString()) //업로드시 파일명 변경가능 (겹치면 안 됨)
    }
  })
});


let db;
const url = process.env.DB_URL;
new MongoClient(url).connect().then((client) => {
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


// __dirname : 현재 프로젝트의 절대 경로 (server.js 담긴 폴더)
app.get('/', (요청, 응답) => {
    응답.sendFile(__dirname + '/index.html');
});

app.get('/list', async (요청, 응답) => {
    // post 컬렉션의 모든 document 출력 - 외워
    let result = await db.collection('post').find().toArray();
    응답.render('list.ejs', { list: result });
});


app.post('/add', (요청, 응답) => {

    upload.single('img1')(요청, 응답, async (err) => {
        // 이미지 업로드시 에러 처리
        if (err) return 응답.send('업로드 에러');
        // 업로드 완료 시 실행할 코드

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
                const result = await db.collection('post').insertOne(
                    {
                        title: 요청.body.title,
                        content: 요청.body.content,
                        img: 요청.file.location
                    });
                응답.redirect('/list');
            }
    
        } catch (e) {
            // 에러 원인
            console.log(e)
            // 에러 시 에러 코드 전송
            응답.status(500).send('서버에러남');
        }
    })
});

// 상세페이지
// 1. 유저가 /detail/어쩌구 접속하면
// 2. {_id: 어쩌구} 글을 DB에서 찾ㅇ사ㅓ
// 3. ejs 파일에 박아서 보내줌
// 파라미터 여러개 넣을 수 있음 /:param1/:param2 ...
app.get('/detail/:id', async (요청, 응답) => {
    try {
        // document 하나 가져옴
        let result = await db.collection('post').findOne({ _id: new ObjectId(요청.params.id) });
        if (result == null) {
            응답.status(404).send('이상한 url');
        }

        응답.render('detail.ejs', { post: result, id: 요청.params.id });
    } catch (e) {
        응답.status(404).send('이상한 url');
    }
});

// 수정 기능
// 수정 버튼 누르면 수정 페이지로
// 수정 페이지엔 기존 글 채워져 있음
// 전송 누르면 확인 후 입력한 내용으로 DB 수정
app.get('/edit/:id', async (요청, 응답) => {
    let result = await db.collection('post').findOne({ _id: new ObjectId(요청.params.id) });
    응답.render('edit.ejs', { post: result });
});


app.put('/edit/:id', async (요청, 응답) => {
    try {
        let result = await db.collection('post').updateOne({ _id: new ObjectId(요청.params.id) }, {
            $set: {
                title: 요청.body.title,
                content: 요청.body.content
            }
        });
        console.log(result);
        응답.redirect('/list');
    } catch (e) {
        console.log(e);
        응답.status(500).send('에러남');
    }
});

// 삭제 기능
// 글 삭제 버튼 누르면 서버로 요청
// 서버는 확인 후 해당 글 DB에서 삭제
app.delete('/doc/:id', async (요청, 응답) => {
    let result = await db.collection('post').deleteOne({ _id: new ObjectId(요청.params.id) });
    console.log(result);
    // ajax 사용 시 응답.redirect, 응답.render 사용 안하는게 좋음
    응답.send('삭제완료');
});

// 페이지네이션
// 1번 버튼 누르면 1-5 보여줌 (/list/1 페이지)
// 2번 버튼 누르면 6~10 보여줌 (/list/2 페이지)
// 3번 버튼 누르면 11~15 보여줌 (/list/3 페이지)
app.get('/list/:id', async (요청, 응답) => {
    // skip 너무 많이 하면 성능 저하

    let skip = (요청.params.id - 1) * 5;
    let result = await db.collection('post').find().skip(skip).limit(5).toArray();
    응답.render('list.ejs', { list: result });
});
app.get('/list/next/:id', async (요청, 응답) => {
    // 조건식 이용하여 다음 게시물 가져오기
    // 현재 보고 있는 페이지의 마지막 글 id보다 큰 것들을 위에서 5개 가져오는 코드
    let result = await db.collection('post').find({ _id: { $gt: new ObjectId(요청.params.id) } }).limit(5).toArray();
    응답.render('list.ejs', { list: result });
});

// n 번째 글 보여주려면..?
// id를 직접 1씩증가하는 정수로 만들기



// 회원가입 passport 라이브러리 사용
// session 방식
// 1. 가입 기능
// 2. 로그인 기능
// 3. 로그인 완료시 세션 만들기
// 4. 로그인 완료시 유저에게 입장권 보내줌
// 5. 로그인 여부 확인하고 싶으면 입장권 까봄

// express-session 세션 만드는 거 도와주는 라이브러리
// passport 회원 인증을 도와주는 메인 라이브러리
// passport-local 아이디 비번 방식으로 회원 인증하고 싶을 때 쓰는 라이브러리

// 제출한 아이디/비번 검사 : 라이브러리 사용..
// passport.authenticate('local')() 쓰면 실행됨
// 아이디/비번 외에 다른 것도 제출받아서 검증 가능
// - passReqToCallback 옵션
passport.use(new LocalStrategy(async (입력한아이디, 입력한비번, cb) => {
    try {

        let result = await db.collection('user').findOne({ username: 입력한아이디 })
        if (!result) {
            return cb(null, false, { message: '아이디 DB에 없음' })
        }
        // 유저가 입력한 비번도 해싱해서 비교
        if (await bcrpyt.compare(입력한비번, result.password)) {
            return cb(null, result)
        } else {
            return cb(null, false, { message: '비번불일치' });
        }

    } catch {
        // DB 에러나면 에러메세지..
    }
}));

// 로그인 성공 시 세션 부여, 유저에게 쿠키 보내기
// 요청.logIn() 쓸 때마다 자동 실행
// user : 로그인 중인 유저 정보
// - passport.use() 에서 return된 result
passport.serializeUser((user, done) => {
    // nodejs에서 특정 코드를 비동기적으로 처리 (처리 보류)
    process.nextTick(() => {
        // 세션 document를 메모리에 발행해줌
        // DB에 발행하려면 passport랑 DB 연결해야함
        done(null, { id: user._id, username: user.username });
    });
});

// 유저가 보낸 쿠키 분석 (유저의 세션이랑 비교)
// 쿠키가 이상 없으면 현재 로그인 된 유저 정보 반환
// 세션 정보 적힌 쿠키를 가지고 있는 유저가 요청 날릴 때마다 실행되는데, 특정 API에서만 실행시키는 방법 있음 (검색할것)
// 그래도 요청이 많아서 DB 부담스러우면 redis 사용 고려..
passport.deserializeUser(async (user, done) => {
    // 세션 document에 적힌 유저 정보를 갱신해서 담아줌
    let result = await db.collection('user').findOne({ _id: new ObjectId(user.id) });

    // 비번은 삭제
    delete result.password;
    process.nextTick(() => {
        done(null, result);
    });
});

// 이제 위 코드 밑의 아무 API에서 요청.user 쓰면 로그인 된 유저 정보 알려줌

// 로그인 페이지
app.get('/login', (요청, 응답) => {
    응답.render('login.ejs');
});

// 로그인 버튼 눌렀을 때
app.post('/login', (요청, 응답, next) => {
    // 제출한 아이디/비번이 DB에 있는거랑 일치하는지 확인하고 세션 생성
    passport.authenticate('local', (error, user, info) => {
        // error : 에러시 반환됨
        // user : 성공시 반환되는 유저 정보
        // info : 로그인 실패 시 들어오는 정보 

        if (error) return 응답.status(500).json(error);
        if (!user) return 응답.status(401).json(info.message);
        요청.logIn(user, (error) => {
            if (error) return next(error);
            응답.redirect('/list/1');
        });
    })(요청, 응답, next);
});


// 숙제 : 마이페이지
// 로그인 한 유저 아이디 표시하기
app.get('/mypage', (요청, 응답) => {
    응답.render('mypage.ejs', { user: 요청.user });
});

// 회원가입
app.get('/register', (요청, 응답) => {
    응답.render('register.ejs');
});

app.post('/register', async (요청, 응답) => {
    // 아이디 중복 체크
    let isDuplicate = await db.collection('user').findOne({ username: 요청.body.username });

    if (isDuplicate == null) {
        // 비번은 hashing을 이용 : 어떤 문자를 랜덤한 문자로 변환
        // bcrpyt 알고리즘 사용할 것임
        // 비번 hashing 
        // 문자 뒤에 랜덤 문자(salt)를 붙여서 그걸 해싱
        // - lookup table attack / rainbow table attack 해킹 방어 가능
        // 두번째 파라미터는 얼마나 꼬을지의 정도..

        let hashedPassword = await bcrpyt.hash(요청.body.password, 10);
        let result = await db.collection('user').insertOne({
            username: 요청.body.username,
            password: hashedPassword
        });
        응답.redirect('/login');
    }

});

// 글쓰기
app.get('/write', (요청, 응답) => {
    // 로그인 한 사람만 글 작성 가능하게
    if (요청.user == undefined) {
        응답.render('login.ejs');
    } else {
        응답.render('write.ejs');
    }
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



// 이미지 저장 : 파일 저장용 클라우드 서비스 이용
// - AWS S3
//   - 계정 생성하고 권한 세팅 필요

// 1. 글 작성 페이지에 이미지 <input>
// 2. 서버는 이미지 받으면 S3에 업로드
//  - multer / formidable 라이브러리 쓰면 편함
//      - multer: 유저가 보낸 파일을 다루기 쉽게 도와줌
//      - multer-s3: S3 업로드를 쉽게 해줌
//      - @aws-sdk/client-s3 : AWS 사용 시 필요
// 3. 이미지 URL은 DB에 글과 함께 저장
// 4. 이미지 필요하면 DB에 있던 URL 꺼내서 html에 넣기