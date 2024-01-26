let router = require('express').Router();

const { ObjectId } = require('mongodb');
const { checkLogin } = require('./../Utils/login.js');

router.use('/', require('./login.js'));

let db;
let connectDB = require('./../database.js');
connectDB.then((client) => {
    db = client.db('forum');
}).catch((err) => {
    console.log(err);
});


// AWS-S3 세팅
const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = new S3Client({
    region: 'ap-northeast-2',
    credentials: {
        accessKeyId: process.env.S3_KEY,
        secretAccessKey: process.env.S3_SECRET
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

// 글 목록
router.get('/list', async (요청, 응답) => {
    // post 컬렉션의 모든 document 출력 - 외워
    let result = await db.collection('post').find().toArray();
    응답.render('list.ejs', { list: result });
});

// 글 쓰기
router.get('/write', checkLogin, (요청, 응답) => {
    // 로그인 한 사람만 글 작성 가능하게
    응답.render('write.ejs');
});

router.post('/add', (요청, 응답) => {

    upload.single('img1')(요청, 응답, async (err) => {
        // 이미지 업로드시 에러 처리
        if (err) return 응답.send('업로드 에러');
        // 업로드 완료 시 실행할 코드
        let img;
        if (!요청.file) {
            img = null;
        }
        
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
                        img: img
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
// 2. {_id: 어쩌구} 글을 DB에서 찾아서
// 3. ejs 파일에 박아서 보내줌
// 파라미터 여러개 넣을 수 있음 /:param1/:param2 ...
router.get('/detail/:id', async (요청, 응답) => {
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
router.get('/edit/:id', async (요청, 응답) => {
    let result = await db.collection('post').findOne({ _id: new ObjectId(요청.params.id) });
    응답.render('edit.ejs', { post: result });
});


router.put('/edit/:id', async (요청, 응답) => {
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
router.delete('/doc/:id', async (요청, 응답) => {
    let result = await db.collection('post').deleteOne({ _id: new ObjectId(요청.params.id) });
    console.log(result);
    // ajax 사용 시 응답.redirect, 응답.render 사용 안하는게 좋음
    응답.send('삭제완료');
});

// 페이지네이션
// 1번 버튼 누르면 1-5 보여줌 (/list/1 페이지)
// 2번 버튼 누르면 6~10 보여줌 (/list/2 페이지)
// 3번 버튼 누르면 11~15 보여줌 (/list/3 페이지)
router.get('/list/:id', async (요청, 응답) => {
    // skip 너무 많이 하면 성능 저하

    let skip = (요청.params.id - 1) * 5;
    let result = await db.collection('post').find().skip(skip).limit(5).toArray();
    응답.render('list.ejs', { list: result });
});
router.get('/list/next/:id', async (요청, 응답) => {
    // 조건식 이용하여 다음 게시물 가져오기
    // 현재 보고 있는 페이지의 마지막 글 id보다 큰 것들을 위에서 5개 가져오는 코드
    let result = await db.collection('post').find({ _id: { $gt: new ObjectId(요청.params.id) } }).limit(5).toArray();
    응답.render('list.ejs', { list: result });
});

// n 번째 글 보여주려면..?
// id를 직접 1씩증가하는 정수로 만들기


// 게시물 검색 기능
// 1. input과 버튼에서 서버로 검색어 전송
// 2. 서버는 그 검색어가 포함된 document 가져와서 (정규식 쓰면 쉬움)
// 3. ejs 에 넣어서 유저에게 보냄
router.get('/search', async (요청, 응답) => {
    let searchWord = 요청.query.searchWord;
    // 심각한 문제점 : document 많으면 find 느림
    // 빠르게 찾고 싶으면 index를 만들자
    // Binary search : 반씩 잘라가며 검색 (미리 정렬해야함)
    // index : 컬렉션 복사해서 미리 정렬해둔 것
    // - 단점 : 용량 차지함, document 추가/수정/삭제 시 index에도 반영해야 함
    // - 정규식 못씀(영어는 단어마다 다 띄어쓰기 돼서 상관X)


    // > Search Index (full text index) 만들면 해결
    // search index 동작 원리
    // 1. 문장에서 조사, 불용어 제거(을/를 이/가 ...)
    // 2. 모든 단어들 뽑아서 정렬
    // 3. 어떤 document에 등장했는지 표기
    // - 검색어 autocomplete
    // - synonym 포함 검색
    // - 검색 순위 조절 등 가능

    let 검색조건 = [
        {
            $search: {
                index: 'title_index',
                text: { query: searchWord, path: 'title' }
            }
        }
        /*
        { // 결과 정렬 (역순은 -1)
            $sort: {
                _id: 1
            }
        },
        { // 10개만 보여줌
            $limit : 10
        },
        { // 10개 뛰어넘고 보여줌
            $skip : 10
        },
        { // 필드값 숨기기 (0은 숨기기, 1은 보여주기)
            $project : {
                title : 0
            }
        }
        */
    ];

    let result = await db.collection('post').aggregate(검색조건).toArray();

    응답.json(result);
});



module.exports = router;