// login 관련 유틸
// 로그인 체크
const checkLogin = function (요청, 응답, next) {
    if(!요청.user) {
        응답.redirect('/login');
    } else {
        next();
    }
}

module.exports = {
    checkLogin
};