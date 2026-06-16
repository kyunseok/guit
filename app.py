import streamlit as st

# 페이지 기본 설정 (가운데 정렬)
st.set_page_config(page_title="기타하나", page_icon="🎸", layout="centered")

# 사용자가 어떤 버튼을 눌렀는지 기억하기 위한 세션 상태 초기화
if 'current_view' not in st.session_state:
    st.session_state['current_view'] = '메인'

# 1. 헤더 영역 (동아리 이름 크게)
st.markdown("<h1 style='text-align: center; font-size: 4rem; margin-bottom: 2rem;'>기타하나</h1>", unsafe_allow_html=True)

# 2. 내비게이션 버튼 영역 (위에서부터 순서대로)
# 컨테이너와 컬럼을 써서 버튼을 가운데 예쁘게 정렬합니다.
col1, col2, col3 = st.columns([1, 2, 1])
with col2:
    if st.button("동아리 정보", use_container_width=True):
        st.session_state['current_view'] = '동아리 정보'
        
    if st.button("동아리 일정", use_container_width=True):
        st.session_state['current_view'] = '동아리 일정'
        
    if st.button("신입부원 모집", use_container_width=True):
        st.session_state['current_view'] = '신입부원 모집'

st.markdown("---")

# 3. 버튼 클릭에 따라 아래에 보여줄 내용 분기 처리
if st.session_state['current_view'] == '동아리 정보':
    st.subheader("🎸 동아리 정보")
    st.write("기타하나의 소개 및 활동 내역이 들어갈 자리입니다.")

elif st.session_state['current_view'] == '동아리 일정':
    st.subheader("📅 동아리 일정")
    st.write("이번 학기 정기 모임 및 공연 일정이 들어갈 자리입니다.")

elif st.session_state['current_view'] == '신입부원 모집':
    st.subheader("📝 신입부원 모집")
    st.write("기타하나와 함께할 신입부원을 모집합니다! 아래 지원서를 작성해 주세요.")
    
    # 수정하신 DB 스키마 구조를 반영한 지원서 폼
    with st.form("recruitment_form"):
        st.text_input("이름")
        st.text_input("학번")
        st.text_input("연락처")
        
        # 길이가 긴 글을 받을 수 있는 text_area 사용
        st.text_area("지원 사유", placeholder="기타하나에 지원하게 된 동기를 자유롭게 적어주세요.")
        
        submitted = st.form_submit_button("지원서 제출하기")
        if submitted:
            st.success("지원서가 성공적으로 임시 제출되었습니다! (추후 DB 연동 예정)")
else:
    # 처음 사이트에 들어왔을 때 빈 공간을 안내 문구로 채움
    st.markdown("<p style='text-align: center;'>위 버튼을 클릭하여 메뉴를 확인하세요.</p>", unsafe_allow_html=True)
