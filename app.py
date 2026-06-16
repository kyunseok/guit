import streamlit as st
from supabase import create_client, Client

# 페이지 기본 설정
st.set_page_config(page_title="기타하나", page_icon="🎸", layout="centered")

# 🔐 Supabase 클라이언트 초기화 (secrets.toml에서 인증정보를 자동으로 읽어옴)
url: str = st.secrets["supabase"]["url"]
key: str = st.secrets["supabase"]["key"]
supabase: Client = create_client(url, key)

# 사용자가 어떤 버튼을 눌렀는지 기억하기 위한 세션 상태 초기화
if 'current_view' not in st.session_state:
    st.session_state['current_view'] = '메인'

# 1. 헤더 영역
st.markdown("<h1 style='text-align: center; font-size: 4rem; margin-bottom: 2rem;'>기타하나</h1>", unsafe_allow_html=True)

# 2. 내비게이션 버튼 영역
col1, col2, col3 = st.columns([1, 2, 1])
with col2:
    if st.button("동아리 정보", use_container_width=True):
        st.session_state['current_view'] = '동아리 정보'
    if st.button("동아리 일정", use_container_width=True):
        st.session_state['current_view'] = '동아리 일정'
    if st.button("신입부원 모집", use_container_width=True):
        st.session_state['current_view'] = '신입부원 모집'

st.markdown("---")

# 3. 화면 분기 처리
if st.session_state['current_view'] == '동아리 정보':
    st.subheader("🎸 동아리 정보")
    st.write("기타하나의 소개 및 활동 내역이 들어갈 자리입니다.")

elif st.session_state['current_view'] == '동아리 일정':
    st.subheader("📅 동아리 일정")
    st.write("이번 학기 정기 모임 및 공연 일정이 들어갈 자리입니다.")

elif st.session_state['current_view'] == '신입부원 모집':
    st.subheader("📝 신입부원 모집")
    st.write("기타하나와 함께할 신입부원을 모집합니다!")
    
    # 지원서 폼 생성
    with st.form("recruitment_form", clear_on_submit=True):
        name = st.text_input("이름")
        student_id = st.text_input("학번")
        phone = st.text_input("연락처")
        motive = st.text_area("지원 사유", placeholder="기타하나에 지원하게 된 동기를 자유롭게 적어주세요.")
        
        submitted = st.form_submit_button("지원서 제출하기")
        
        if submitted:
            # 모든 항목이 입력되었는지 검증
            if name and student_id and phone and motive:
                try:
                    # 💾 Supabase DB에 데이터 삽입
                    response = supabase.table("applicants").insert({
                        "name": name,
                        "student_id": student_id,
                        "phone": phone,
                        "motive": motive
                    }).execute()
                    
                    st.success(f"🎉 {name}님의 지원서가 성공적으로 접수되었습니다!")
                except Exception as e:
                    st.error(f"데이터 저장 중 오류가 발생했습니다: {e}")
            else:
                st.warning("⚠️ 모든 필드를 작성해 주세요.")
else:
    st.markdown("<p style='text-align: center;'>위 버튼을 클릭하여 메뉴를 확인하세요.</p>", unsafe_allow_html=True)
