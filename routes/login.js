let router = require('express').Router();

// passport 라이브러리 세팅 (순서 중요)
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const MongoStore = require('connect-mongo'); // 세션데이터를 DB에 저장하기 위한 라이브러리
// bcrypt 세팅
const bcrpyt = require('bcrypt');

// DB 연결
const { ObjectId } = require('mongodb');

router.use(passport.initialize())
router.use(session({
    secret: '암호화에 쓸 비번', // 암호화할 때 쓸 비밀번호, 세션의 document id는 암호화해서 유저에게 보냄
    resave: false, // 유저가 서버로 요청할 때마다 세션 갱신할건지
    saveUninitialized: false, // 로그인 안 해도 세션을 만들 것인지
    cookie: { maxAge: 60 * 60 * 1000 }, // 세션 유지 시간 (단위 ms)
    store: MongoStore.create({
        mongoUrl: process.env.DB_URL,
        dbName: 'forum'
    })
}));

router.use(passport.session());

// DB 연결
let db;
let connectDB = require('./../database.js');
connectDB.then((client) => {
    db = client.db('forum');
}).catch((err) => {
    console.log(err);
});

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
router.get('/login', (요청, 응답) => {
    응답.render('login.ejs');
});

// 로그인 버튼 눌렀을 때
router.post('/login', (요청, 응답, next) => {
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


// 회원가입
router.get('/register', (요청, 응답) => {
    응답.render('register.ejs');
});

router.post('/register', async (요청, 응답) => {
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

module.exports = router;