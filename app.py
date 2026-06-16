import streamlit as st
import pandas as pd
import uuid
from supabase import create_client, Client

st.set_page_config(page_title="기타하나", page_icon="🎸", layout="centered")

# 1. 헤더 및 소셜 링크 영역
st.markdown("<h1 style='text-align: center; font-size: 4rem; margin-bottom: 0.5rem;'>기타하나</h1>", unsafe_allow_html=True)

col_img1, col_img2, col_img3 = st.columns([1, 2, 1])
with col_img2:
    st.image("guitLogo.png", use_container_width=True)

st.markdown('<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">', unsafe_allow_html=True)

button_html = """
<div style="display: flex; justify-content: center; gap: 20px; margin-bottom: 2rem;">
    <a href="http://www.youtube.com/@guitarhanapostech" target="_blank" style="color: #FF0000; font-size: 2.5rem; text-decoration: none;">
        <i class="fa-brands fa-youtube"></i>
    </a>
    <a href="https://www.instagram.com/postech_guitarhana" target="_blank" style="color: #E1306C; font-size: 2.5rem; text-decoration: none;">
        <i class="fa-brands fa-instagram"></i>
    </a>
</div>
"""
st.markdown(button_html, unsafe_allow_html=True)

# Supabase 클라이언트 초기화
url: str = st.secrets["supabase"]["url"]
key: str = st.secrets["supabase"]["key"]
supabase: Client = create_client(url, key)

# 세션 상태 초기화
if 'current_view' not in st.session_state:
    st.session_state['current_view'] = '동아리 소개'
if 'auth_level' not in st.session_state:
    st.session_state['auth_level'] = 'none' # 'none', 'member', 'admin'
if 'setlist_sessions' not in st.session_state:
    st.session_state['setlist_sessions'] = [{"id": str(uuid.uuid4()), "role": "보컬", "name": ""}]

# 2. 내비게이션 버튼 영역
if st.button("동아리 소개", use_container_width=True): 
    st.session_state['current_view'] = '동아리 소개'
if st.button("동아리 일정", use_container_width=True): 
    st.session_state['current_view'] = '동아리 일정'
if st.button("신입부원 모집", use_container_width=True): 
    st.session_state['current_view'] = '신입부원 모집'
if st.button("🎸 기존부원 대시보드", use_container_width=True): 
    st.session_state['current_view'] = '기존부원 대시보드'

st.markdown("---")

# 3. 화면 분기 처리
if st.session_state['current_view'] == '동아리 소개':
    st.subheader("🎸 동아리 소개")
    st.write("기타하나의 소개 및 활동 내역이 들어갈 자리입니다.")

elif st.session_state['current_view'] == '동아리 일정':
    st.subheader("📅 동아리 일정")
    st.write("- **3월 15일:** 신입생 환영회 및 OT")
    st.write("- **4월 10일:** 봄맞이 정기 버스킹")
    st.write("- **5월 20일:** 1학기 정기 공연")
    
    st.divider()
    st.subheader("🎧 셋리스트 신청")
    
    if st.session_state['auth_level'] == 'none':
        st.info("🔒 셋리스트 신청은 기존 부원 전용 기능입니다. 메뉴의 **[기존부원 대시보드]**에서 로그인해 주세요.")
    else:
        song_name = st.text_input("곡 제목", placeholder="예: Marigold")
        artist = st.text_input("아티스트", placeholder="예: Aimyon")
        
        session_types = ["보컬", "통기타", "일렉", "베이스", "드럼", "키보드", "퍼커션", "기타"]
        for i, session in enumerate(st.session_state['setlist_sessions']):
            c1, c2, c3 = st.columns([2, 3, 1]) 
            with c1:
                session['role'] = st.selectbox("세션 구분", session_types, index=session_types.index(session['role']) if session['role'] in session_types else 0, key=f"role_{session['id']}")
            with c2:
                session['name'] = st.text_input("희망 부원 (선택)", value=session['name'], placeholder="이름 입력", key=f"name_{session['id']}")
            with c3:
                st.write("") 
                if st.button("❌", key=f"del_{session['id']}"):
                    st.session_state['setlist_sessions'].pop(i)
                    st.rerun()
                    
        if st.button("➕ 세션 추가"):
            st.session_state['setlist_sessions'].append({"id": str(uuid.uuid4()), "role": "통기타", "name": ""})
            st.rerun()
            
        if st.button("🚀 신청하기", type="primary"):
            if song_name and artist and len(st.session_state['setlist_sessions']) > 0:
                try:
                    clean_sessions = [{"role": s["role"], "name": s["name"]} for s in st.session_state['setlist_sessions']]
                    supabase.table("setlists").insert({"song_name": song_name, "artist": artist, "sessions": clean_sessions}).execute()
                    st.success("✅ 셋리스트 신청 완료!")
                    st.session_state['setlist_sessions'] = [{"id": str(uuid.uuid4()), "role": "보컬", "name": ""}]
                    st.rerun()
                except Exception as e:
                    st.error(f"오류: {e}")
            else:
                st.warning("입력 항목을 확인해 주세요.")

# 📝 4. 신입부원 모집 (운영진 대시보드 결합)
elif st.session_state['current_view'] == '신입부원 모집':
    st.subheader("📝 신입부원 모집")
    
    # 👑 운영진 권한일 때만 보이는 지원자 목록 및 알고리즘 배정
    if st.session_state['auth_level'] == 'admin':
        st.info("👑 운영진 모드: 현재 접수된 지원서 목록 및 면접 배정 기능을 활성화합니다.")
        
        try:
            response = supabase.table("applicants").select("*, interview_slots(interview_time)").order("created_at", desc=True).execute()
            data = response.data
            
            if data:
                app_list = []
                for row in data:
                    slots = [s['interview_time'] for s in row.get('interview_slots', [])]
                    app_list.append({
                        "이름": row['name'], "학번": row['student_id'], "연락처": row['phone'],
                        "slots": slots, "slot_count": len(slots), "지원 사유": row['motive']
                    })
                
                st.write(f"### 📊 총 {len(app_list)}명의 지원자가 대기 중입니다.")
                
                if st.button("🤖 면접 시간 자동 배정 (Greedy 알고리즘)", type="primary"):
                    sorted_apps = sorted(app_list, key=lambda x: x['slot_count'])
                    
                    assigned_times = {} 
                    results = []
                    
                    for app in sorted_apps:
                        assigned_slot = "배정 실패 (수동 조율 필요)"
                        for slot in app['slots']:
                            if slot not in assigned_times:
                                assigned_times[slot] = app['이름']
                                assigned_slot = slot
                                break
                        
                        results.append({
                            "이름": app['이름'], "학번": app['학번'], "연락처": app['연락처'],
                            "배정된 시간": assigned_slot, "지원 사유": app['지원 사유']
                        })
                        
                    result_df = pd.DataFrame(results)
                    st.success("면접 배정이 완료되었습니다!")
                    st.dataframe(result_df, use_container_width=True, hide_index=True)
                    
                    csv = result_df.to_csv(index=False).encode('utf-8-sig')
                    st.download_button(
                        label="📥 결과 다운로드 (CSV)",
                        data=csv,
                        file_name='면접배정결과.csv',
                        mime='text/csv',
                    )
            else:
                st.info("아직 접수된 지원서가 없습니다.")
        except Exception as e:
            st.error(f"데이터를 불러오는 중 오류가 발생했습니다: {e}")
            
        st.divider()
        st.write("#### 👇 아래는 일반 지원자들에게 보여지는 폼 화면입니다.")

    # 일반 사용자 화면 (지원서 제출 폼)
    available_interview_slots = [
        "9월 4일 (수) 18:00 - 18:30", "9월 4일 (수) 18:30 - 19:00",
        "9월 5일 (목) 18:00 - 18:30", "9월 5일 (목) 18:30 - 19:00",
        "9월 6일 (금) 19:00 - 19:30"
    ]
    
    with st.form("recruitment_form", clear_on_submit=True):
        name = st.text_input("이름")
        student_id = st.text_input("학번")
        phone = st.text_input("연락처")
        motive = st.text_area("지원 사유", placeholder="기타하나에 지원하게 된 동기를 자유롭게 적어주세요.")
        
        st.write("---")
        st.write("📅 **면접 가능 일정 선택 (복수 선택 가능)**")
        selected_slots = st.multiselect("가능한 시간을 모두 선택해 주세요.", available_interview_slots)
        
        submitted = st.form_submit_button("지원서 제출하기")
        
        if submitted:
            if name and student_id and phone and motive and selected_slots:
                try:
                    response = supabase.table("applicants").insert({
                        "name": name, "student_id": student_id, "phone": phone, "motive": motive
                    }).execute()
                    
                    new_applicant_id = response.data[0]['id']
                    slots_data = [{"applicant_id": new_applicant_id, "interview_time": slot} for slot in selected_slots]
                    supabase.table("interview_slots").insert(slots_data).execute()
                    
                    st.success(f"🎉 {name}님의 지원서가 성공적으로 접수되었습니다!")
                except Exception as e:
                    st.error(f"데이터 저장 중 오류가 발생했습니다: {e}")
            else:
                st.warning("⚠️ 모든 필드와 면접 가능 일정을 최소 1개 이상 선택해 주세요.")

# 🎸 5. 기존부원 대시보드
elif st.session_state['current_view'] == '기존부원 대시보드':
    st.subheader("🎸 기존부원 대시보드")
    
    if st.session_state['auth_level'] == 'none':
        st.info("부원 또는 운영진 비밀번호를 입력해 주세요.")
        pwd_input = st.text_input("비밀번호", type="password") 
        if st.button("잠금 해제"):
            if pwd_input == st.secrets["admin"]["password"]:
                st.session_state['auth_level'] = 'admin'
                st.rerun()
            elif pwd_input == st.secrets["member"]["password"]:
                st.session_state['auth_level'] = 'member'
                st.rerun()
            else:
                st.error("비밀번호가 틀렸습니다.")
                
    else:
        st.success(f"인증 완료: {'운영진' if st.session_state['auth_level'] == 'admin' else '일반 부원'} 모드")
        
        if st.session_state['auth_level'] == 'member':
            st.write("상단의 **[동아리 일정]** 탭으로 이동하시면 셋리스트를 신청하실 수 있습니다.")
        elif st.session_state['auth_level'] == 'admin':
            st.write("상단의 **[동아리 일정]** 탭에서 셋리스트를 신청할 수 있습니다.")
            st.write("상단의 **[신입부원 모집]** 탭에서 접수된 지원서 확인 및 면접 배정이 가능합니다.")
            
        st.divider()
        if st.button("로그아웃"):
            st.session_state['auth_level'] = 'none'
            st.rerun()

else:
    st.markdown("<p style='text-align: center;'>위 버튼을 클릭하여 메뉴를 확인하세요.</p>", unsafe_allow_html=True)
