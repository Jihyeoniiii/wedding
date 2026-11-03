/* 청첩장 내용 파일
   보통은 직접 고칠 필요 없어요. 청첩장 주소 뒤에 ?edit 를 붙여서 화면에서 고치고 "게시하기"를 누르면 이 파일이 자동으로 바뀝니다. */
window.CONTENT = {
  "site": {
    "groom": {
      "last": "이",
      "first": "준희",
      "phone": "",
      "relation": "아들",
      "father": {
        "name": "",
        "phone": ""
      },
      "mother": {
        "name": "",
        "phone": ""
      }
    },
    "bride": {
      "last": "박",
      "first": "지현",
      "phone": "",
      "relation": "딸",
      "father": {
        "name": "",
        "phone": ""
      },
      "mother": {
        "name": "",
        "phone": ""
      }
    },
    "wedding": {
      "date": "",
      "time": "",
      "venue": "",
      "hall": "",
      "address": "",
      "tel": "",
      "tbdText": "예식 날짜와 장소는\n정해지는 대로 다시 안내드리겠습니다."
    },
    "theme": {
      "accent": "#e08d62",
      "font": "chosun"
    },
    "music": {
      "src": "",
      "autoplay": true
    },
    "api": {
      "scriptUrl": "https://script.google.com/macros/s/AKfycbwSHBnICKGJKkT_W0L70sqEO8likW9cq0POGwQsm97Un8jRE_Ap7c25eSVfE2hKZnLQ5g/exec"
    },
    "rsvpPopup": false,
    "kakaoKey": "",
    "footer": "Junhee & Jihyun",
    "github": {
      "owner": "Jihyeoniiii",
      "repo": "wedding",
      "branch": "main"
    },
    "_pub": 1793712173671
  },
  "blocks": [
    {
      "id": "b1",
      "type": "cover",
      "photo": {
        "src": "images/cover.jpg",
        "x": 50,
        "y": 50,
        "z": 1
      },
      "script": "Happy wedding day",
      "sub": ""
    },
    {
      "id": "b2",
      "type": "greeting",
      "title": "소중한 분들을 초대합니다.",
      "text": "오랜 기다림 속에서 저희 두 사람,\n한 마음 되어 참된 사랑의 결실을\n맺게 되었습니다.\n\n오셔서 축복해 주시면 큰 기쁨이겠습니다."
    },
    {
      "id": "b3",
      "type": "quote",
      "text": "You can not be happy every day.\nBut there are happy things every day.\n\n매일 행복할 순 없지만,\n행복한 것들은 매일 있어.",
      "source": "<월트 디즈니>, 곰돌이 푸 中"
    },
    {
      "id": "b4",
      "type": "profile",
      "groomPhoto": {
        "src": "images/groom.jpg",
        "x": 50,
        "y": 50,
        "z": 1
      },
      "bridePhoto": {
        "src": "images/bride.jpg",
        "x": 50,
        "y": 50,
        "z": 1
      },
      "groomBio": "0000년생, 00사람\n다정한 사랑꾼 **MBTI**\n#취미 #직업\n🌳\n나무같은 남편이 되겠습니다",
      "brideBio": "0000년생, 00사람\n세상의 소금형 **MBTI**\n#취미 #직업\n☀️\n햇살같은 아내가 되겠습니다"
    },
    {
      "id": "b5",
      "type": "calendar",
      "title": "예식 안내"
    },
    {
      "id": "b6",
      "type": "location",
      "title": "오시는 길",
      "items": [
        {
          "icon": "🚌",
          "title": "버스",
          "text": "정해지면 안내드릴게요."
        },
        {
          "icon": "🚆",
          "title": "지하철",
          "text": "정해지면 안내드릴게요."
        },
        {
          "icon": "🚗",
          "title": "자차",
          "text": "정해지면 안내드릴게요."
        }
      ]
    },
    {
      "id": "b7",
      "type": "gallery",
      "title": "갤러리",
      "layout": "grid",
      "photos": [
        "images/gallery/1.jpg",
        "images/gallery/2.jpg",
        "images/gallery/3.jpg",
        "images/gallery/4.jpg",
        "images/gallery/5.jpg",
        "images/gallery/6.jpg",
        "images/gallery/7.jpg",
        "images/gallery/8.jpg"
      ]
    },
    {
      "id": "b8",
      "type": "interview",
      "title": "웨딩 인터뷰",
      "text": "두 분의 인터뷰를 준비했습니다.\n인터뷰를 확인해보세요.",
      "items": [
        {
          "q": "결혼하시는 소감이 어떠세요?",
          "a": "🤵🏻‍♂️ 준희\n여기에 답변을 적어주세요.\n\n👰🏻‍♀️ 지현\n여기에 답변을 적어주세요."
        },
        {
          "q": "처음에 어떻게 만나셨어요?",
          "a": "여기에 답변을 적어주세요."
        },
        {
          "q": "신혼여행은 어디로 가시나요?",
          "a": "여기에 답변을 적어주세요."
        },
        {
          "q": "신혼집은 어디인가요?",
          "a": "여기에 답변을 적어주세요."
        }
      ]
    },
    {
      "id": "b9",
      "type": "history",
      "title": "우리의 히스토리 🎞️",
      "items": [
        {
          "date": "20XX",
          "title": "첫만남",
          "text": "저희는\nOO에서 만났어요.",
          "photo": "images/history/1.jpg"
        },
        {
          "date": "20XX.XX",
          "title": "1주년",
          "text": "첫번째 일년이\n지나가고",
          "photo": "images/history/2.jpg"
        },
        {
          "date": "20XX.XX",
          "title": "프로포즈",
          "text": "평생을 약속했어요.",
          "photo": "images/history/3.jpg"
        },
        {
          "date": "Coming soon",
          "title": "Wedding Day!",
          "text": "저희는 이 날,\n부부가 됩니다.",
          "photo": "images/history/4.jpg"
        }
      ]
    },
    {
      "id": "b10",
      "type": "tabs",
      "items": [
        {
          "tab": "포토부스",
          "photo": "images/info/1.jpg",
          "text": "소중한 날을 기록할 수 있도록\n포토부스를 준비했습니다.\n신랑, 신부와 함께 사진을 찍어주세요."
        },
        {
          "tab": "주차안내",
          "photo": "",
          "text": "주차 안내는\n예식장이 정해지면 알려드릴게요."
        },
        {
          "tab": "답례품",
          "photo": "",
          "text": "예식 후 하객분들께\n감사의 마음을 담아\n작은 선물을 준비했습니다."
        }
      ]
    },
    {
      "id": "b11",
      "type": "accounts",
      "title": "마음 전하실 곳",
      "text": "비대면으로 축하를 전하고자\n하시는 분들을 위해\n계좌번호를 기재하였습니다.\n너그러운 마음으로 양해 부탁드립니다.",
      "groom": [],
      "bride": []
    },
    {
      "id": "b12",
      "type": "rsvp",
      "title": "참석 여부 전달",
      "text": "소중한 시간을 내어 결혼식에\n참석해주시는 모든 분들께 감사드립니다.\n참석 여부를 회신해 주시면\n더욱 감사하겠습니다."
    },
    {
      "id": "b13",
      "type": "photoShare",
      "title": "사진 공유하기",
      "text": "결혼식 날 찍어주신 사진을 나눠주세요.\n저희에게 가장 큰 선물이 됩니다 📸",
      "maxMB": 20
    },
    {
      "id": "b14",
      "type": "guestbook",
      "title": "방명록"
    },
    {
      "id": "b15",
      "type": "together",
      "title": "함께한 시간",
      "since": ""
    },
    {
      "id": "b16",
      "type": "ending",
      "photo": {
        "src": "images/ending.jpg",
        "x": 50,
        "y": 50,
        "z": 1
      },
      "text": "너가 매일 행복할 수는 없지만,\n행복한 일들은 매일 있어.\n\n- 월트디즈니 '곰돌이 푸' 중"
    }
  ]
};
