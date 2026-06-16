import streamlit as st
import pandas as pd
import uuid
import random
import string
from supabase import create_client, Client
import extra_streamlit_components as stx

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
    st.session_state['auth_level'] = 'none' 
if 'setlist_sessions' not in st.session_state:
    st.session_state['setlist_sessions'] = [{"id": str(uuid.uuid4()), "role": "보컬", "name": ""}]
if 'show_greedy_result' not in st.session_state:
    st.session_state['show_greedy_result'] = False

# 2. 내비게이션 버튼 영역
if st.button("동아리 소개", use_container_width=True): 
    st.session_state['current_view'] = '동아리 소개'
if st.button("동아리 일정", use_container_width=True): 
    st.session_state['current_view'] = '동아리 일정'
if st.button("신입부원 모집", use_container_width=True): 
    st.session_state['current_view'] = '신입부원 모집'
if st.button("기존부원 대시보드", use_container_width=True): 
    st.session_state['current_view'] = '기존부원 대시보드'

st.markdown("---")

# 3. 화면 분기 처리
if st.session_state['current_view'] == '동아리 소개':
    st.subheader("🎸 동아리 소개")
    st.write("""기타하나는 어쿠스틱 통기타 동아리입니다. 
            주로 정기공연, 버스킹 등의 행사를 진행하고 기타 뿐만 아니라 키보드, 드럼, 일렉, 베이스 등 여러가지 악기를 다루며 자신이 하고 싶은 곡으로 공연을 꾸며나갈 수 있습니다. 
            또한 신입생들을 위해 동아리 내부에서 기타교실을 운영하기 때문에 기타에 자신이 없어도 동아리에 들어와서 배워나갈 수 있습니다.
            \n\n
            **Contact**
            회장: 경규헌(gyuheon0117@postech.ac.kr)
            웹사이트 관련 문제: 김윤석(kyunseok@postech.ac.kr)""")

elif st.session_state['current_view'] == '동아리 일정':
    st.subheader("📅 동아리 일정")
    st.write("- **8월 23일 - 9월 2일:** 26년도 2학기 신입부원 모집")
    st.write("- **9월 6일 - 9월 8일:** 26년도 2학기 신입부원 면접")
    st.write("- **9월 9일:** 2학기 개강총회")
    st.write("- **9월 12일:** 2학기 엠티")
    
    st.divider()
    st.subheader("🎧 셋리스트 신청")
    
    if st.session_state['auth_level'] == 'none':
        st.info("🔒 셋리스트 신청 및 확인은 기존 부원 전용 기능입니다.")
    else:
        song_name = st.text_input("곡 제목", placeholder="예: Marigold", max_chars=50)
        artist = st.text_input("아티스트", placeholder="예: Aimyon", max_chars=50)
        
        session_types = ["보컬", "통기타", "일렉", "베이스", "드럼", "키보드", "퍼커션", "기타"]
        for i, session in enumerate(st.session_state['setlist_sessions']):
            c1, c2, c3 = st.columns([2, 3, 1]) 
            with c1:
                session['role'] = st.selectbox("세션 구분", session_types, index=session_types.index(session['role']) if session['role'] in session_types else 0, key=f"role_{session['id']}")
            with c2:
                session['name'] = st.text_input("희망 부원 (선택)", value=session['name'], placeholder="이름 입력", key=f"name_{session['id']}", max_chars=10)
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
        
        st.write("---")
        
        st.subheader("📋 현재 신청된 셋리스트")
        try:
            response = supabase.table("setlists").select("*").order("created_at", desc=True).execute()
            setlists_data = response.data
            
            if setlists_data:
                formatted_data = []
                for row in setlists_data:
                    sessions_str = ", ".join([f"{s['role']}({s['name'] if s['name'] else '미정'})" for s in row['sessions']])
                    
                    formatted_data.append({
                        "곡 제목": row['song_name'],
                        "아티스트": row['artist'],
                        "세션 구성": sessions_str,
                        "신청 일시": row['created_at']
                    })
                    
                df_setlists = pd.DataFrame(formatted_data)
                df_setlists['신청 일시'] = pd.to_datetime(df_setlists['신청 일시']).dt.strftime('%Y-%m-%d %H:%M')
                st.dataframe(df_setlists, use_container_width=True, hide_index=True)
            else:
                st.info("아직 신청된 셋리스트가 없습니다.")
        except Exception as e:
            st.error(f"데이터를 불러오는 중 오류가 발생했습니다: {e}")

# 📝 4. 신입부원 모집
elif st.session_state['current_view'] == '신입부원 모집':
    st.subheader("📝 신입부원 모집")
    
    tab1, tab2 = st.tabs(["✍️ 지원서 작성", "🔍 제출 내역 확인"])
    
    with tab1:
        available_interview_slots = [
            "9월 4일 (수) 18:00 - 18:30", "9월 4일 (수) 18:30 - 19:00",
            "9월 5일 (목) 18:00 - 18:30", "9월 5일 (목) 18:30 - 19:00",
            "9월 6일 (금) 19:00 - 19:30"
        ]
        
        with st.form("recruitment_form", clear_on_submit=True):
            name = st.text_input("이름", max_chars=10)
            student_id = st.text_input("학번", max_chars=20)
            phone = st.text_input("연락처", max_chars=15)
            motive = st.text_area("지원 사유", placeholder="기타하나에 지원하게 된 동기를 자유롭게 적어주세요.", max_chars=1000)
            
            st.write("---")
            st.write("📅 **면접 가능 일정 선택 (복수 선택 가능)**")
            selected_slots = st.multiselect("가능한 시간을 모두 선택해 주세요.", available_interview_slots)
            
            submitted = st.form_submit_button("지원서 제출하기")
            
            if submitted:
                if name and student_id and phone and motive and selected_slots:
                    try:
                        # 6자리 영문+숫자 난수 ID 생성 및 중복 확인
                        while True:
                            # 영문 대문자와 숫자를 조합하여 6자리 코드 생성
                            new_app_id = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
                            check_dup = supabase.table("applicants").select("id").eq("id", new_app_id).execute()
                            if not check_dup.data:
                                break 
                        
                        supabase.table("applicants").insert({
                            "id": new_app_id, "name": name, "student_id": student_id, "phone": phone, "motive": motive
                        }).execute()
                        
                        slots_data = [{"applicant_id": new_app_id, "interview_time": slot} for slot in selected_slots]
                        supabase.table("interview_slots").insert(slots_data).execute()
                        
                        st.success(f"🎉 성공적으로 접수되었습니다! 본인의 지원서 코드는 [{new_app_id}] 입니다.\n원할 경우 언제든지 지원서 코드를 이용해 본인의 지원서를 조회할 수 있습니다.")
                    except Exception as e:
                        st.error(f"데이터 저장 중 오류가 발생했습니다: {e}")
                else:
                    st.warning("⚠️ 모든 필드와 면접 가능 일정을 최소 1개 이상 선택해 주세요.")

    with tab2:
        st.write("발급받은 6자리 지원서 코드를 입력하여 제출 내역을 확인할 수 있습니다.")
        search_id = st.text_input("지원서 코드 (6자리 영문/숫자)", max_chars=6)
        
        if st.button("내 지원서 조회하기"):
            if search_id:
                try:
                    # 사용자가 소문자로 입력해도 대문자로 변환하여 검색되도록 처리
                    search_id = search_id.upper()
                    response = supabase.table("applicants").select("*, interview_slots(interview_time)").eq("id", search_id).execute()
                    
                    if response.data:
                        app_data = response.data[0]
                        st.success(f"✅ {app_data['name']}님의 지원서는 다음과 같습니다.")
                        
                        st.write(f"**학번:** {app_data['student_id']}")
                        st.write(f"**연락처:** {app_data['phone']}")
                        st.write(f"**지원 사유:**\n> {app_data['motive']}")
                        
                        slots = [s['interview_time'] for s in app_data.get('interview_slots', [])]
                        st.write(f"**선택한 면접 일정:** {', '.join(slots) if slots else '없음'}")
                        st.write(f"**접수 일시:** {pd.to_datetime(app_data['created_at']).strftime('%Y-%m-%d %H:%M')}")
                        
                    else:
                        st.error("❌ 일치하는 지원서 코드가 없습니다.")
                except Exception as e:
                    st.error(f"조회 중 오류가 발생했습니다: {e}")
            else:
                st.warning("지원서 코드를 입력해 주세요.")

    if st.session_state['auth_level'] == 'admin':
        st.divider()
        st.subheader("지원서 현황 및 면접 배정 관리")
        
        try:
            response = supabase.table("applicants").select("*, interview_slots(interview_time)").order("created_at", desc=True).execute()
            data = response.data
            
            if data:
                app_list = []
                for row in data:
                    slots = [s['interview_time'] for s in row.get('interview_slots', [])]
                    app_list.append({
                        "지원서코드": row['id'],
                        "이름": row['name'], 
                        "학번": row['student_id'], 
                        "연락처": row['phone'],
                        "면접 가능 시간": ", ".join(slots) if slots else "선택 안함",
                        "지원 사유": row['motive'],
                        "접수 일시": row['created_at'],
                        "slots_raw": slots,
                        "slot_count": len(slots)
                    })
                
                st.write(f"##### 전체 지원서 목록 (총 {len(app_list)}명)")
                df_all = pd.DataFrame(app_list)
                
                df_display = df_all.drop(columns=['slots_raw', 'slot_count'])
                df_display['접수 일시'] = pd.to_datetime(df_display['접수 일시']).dt.strftime('%Y-%m-%d %H:%M')
                st.dataframe(df_display, use_container_width=True, hide_index=True)
                
                st.write("")
                
                if st.button("면접 시간 자동 배정", type="primary"):
                    st.session_state['show_greedy_result'] = True
                
                if st.session_state['show_greedy_result']:
                    st.write("##### 면접 시간 자동 배정 결과")
                    
                    sorted_apps = sorted(app_list, key=lambda x: x['slot_count'])
                    
                    assigned_times = {} 
                    results = []
                    
                    for app in sorted_apps:
                        assigned_slot = "배정 실패 (수동 조율 필요)"
                        for slot in app['slots_raw']:
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
                        label="배정 결과 다운로드 (CSV)",
                        data=csv,
                        file_name='면접배정결과.csv',
                        mime='text/csv',
                    )
            else:
                st.info("아직 접수된 지원서가 없습니다.")
        except Exception as e:
            st.error(f"데이터를 불러오는 중 오류가 발생했습니다: {e}")

# 🎸 5. 기존부원 대시보드
elif st.session_state['current_view'] == '기존부원 대시보드':
    st.subheader("🎸 기존부원 대시보드")
    
    if st.session_state['auth_level'] == 'none':
        # 1. 쿠키 매니저 초기화
        cookie_manager = stx.CookieManager()
        
        # 2. 현재 실패 횟수 가져오기 (없으면 0으로 시작)
        # 스트림릿 특성상 쿠키를 읽어오는 데 아주 짧은 딜레이가 있어 예외 처리를 합니다.
        failed_attempts = cookie_manager.get(cookie="fail_count")
        if failed_attempts is None:
            failed_attempts = 0
        else:
            failed_attempts = int(failed_attempts)
            
        # 3. 5회 이상 실패 시 입력창 숨기고 에러 메시지 고정
        if failed_attempts >= 5:
            st.error("🔒 로그인 시도를 5회 연속 실패하여 브라우저 접근이 일시 차단되었습니다.")
            st.warning("비밀번호를 잊으셨다면 관리자에게 문의해 주세요.")
            
        # 4. 5회 미만일 때만 입력창 띄우기
        else:
            st.info("비밀번호를 입력해 주세요.")
            pwd_input = st.text_input("비밀번호", type="password", max_chars=30) 
            
            if st.button("잠금 해제"):
                if pwd_input == st.secrets["admin"]["password"]:
                    cookie_manager.delete("fail_count") # 성공 시 실패 기록 초기화
                    st.session_state['auth_level'] = 'admin'
                    st.rerun()
                elif pwd_input == st.secrets["member"]["password"]:
                    cookie_manager.delete("fail_count") # 성공 시 실패 기록 초기화
                    st.session_state['auth_level'] = 'member'
                    st.rerun()
                else:
                    # 실패 시 쿠키에 +1 누적 (유효기간: 1시간 = 3600초)
                    new_fails = failed_attempts + 1
                    cookie_manager.set("fail_count", new_fails, max_age=3600)
                    st.error(f"비밀번호가 틀렸습니다. (실패 횟수: {new_fails}/5)")
                    
    else:
        st.success(f"인증 완료: {'회장단' if st.session_state['auth_level'] == 'admin' else '부원'}")
        
        if st.session_state['auth_level'] == 'member':
            st.write("상단의 **[동아리 일정]** 탭으로 이동하시면 셋리스트를 신청하고 확인하실 수 있습니다.")
        elif st.session_state['auth_level'] == 'admin':
            st.write("상단의 **[동아리 일정]** 탭에서 셋리스트를 신청하고 확인할 수 있습니다.")
            st.write("상단의 **[신입부원 모집]** 탭에서 접수된 지원서 확인 및 면접 배정이 가능합니다.")
            
        st.divider()
        if st.button("로그아웃"):
            st.session_state['auth_level'] = 'none'
            st.session_state['show_greedy_result'] = False 
            st.rerun()

else:
    st.markdown("<p style='text-align: center;'>위 버튼을 클릭하여 메뉴를 확인하세요.</p>", unsafe_allow_html=True)
