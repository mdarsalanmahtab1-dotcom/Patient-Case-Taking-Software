import re

with open('dialogue_manager.py', 'r', encoding='utf-8') as f:
    code = f.read()

# I will replace the exact text blocks for each occurrence.

# Occurrence 1:
#                     database.commit_fsm_checkpoint(
#                         session_id=self.record.session_id,
#                         filled_state=record_payload,
#                         chief_complaint=str(self.record.chief_complaint.value or ""),
#                         interview_qa=self.record.conversation_history,
#                         priority_flag=has_red_flags,
#                         status="IN_PROGRESS"
#                     )
code = code.replace('''database.commit_fsm_checkpoint(
                        session_id=self.record.session_id,
                        filled_state=record_payload,
                        chief_complaint=str(self.record.chief_complaint.value or ""),
                        interview_qa=self.record.conversation_history,
                        priority_flag=has_red_flags,
                        status="IN_PROGRESS"
                    )''', '''asyncio.run_coroutine_threadsafe(
                        database.commit_fsm_checkpoint(
                            session_id=self.record.session_id,
                            filled_state=record_payload,
                            chief_complaint=str(self.record.chief_complaint.value or ""),
                            interview_qa=self.record.conversation_history,
                            priority_flag=has_red_flags,
                            status="IN_PROGRESS"
                        ),
                        asyncio.get_event_loop()
                    )''')

# Occurrence 2:
#             database.commit_fsm_checkpoint(
#                 session_id=self.record.session_id,
#                 filled_state=self.record.filled_state,
#                 chief_complaint=str(self.record.chief_complaint.value or ""),
#                 interview_qa=self.record.conversation_history,
#                 priority_flag=False,
#                 status="IN_PROGRESS"
#             )
code = code.replace('''database.commit_fsm_checkpoint(
                session_id=self.record.session_id,
                filled_state=self.record.filled_state,
                chief_complaint=str(self.record.chief_complaint.value or ""),
                interview_qa=self.record.conversation_history,
                priority_flag=False,
                status="IN_PROGRESS"
            )''', '''asyncio.run_coroutine_threadsafe(
                database.commit_fsm_checkpoint(
                    session_id=self.record.session_id,
                    filled_state=self.record.filled_state,
                    chief_complaint=str(self.record.chief_complaint.value or ""),
                    interview_qa=self.record.conversation_history,
                    priority_flag=False,
                    status="IN_PROGRESS"
                ),
                asyncio.get_event_loop()
            )''')

# Occurrence 3:
#                 database.commit_fsm_checkpoint(
#                     session_id=self.record.session_id,
#                     filled_state=record_payload,
#                     chief_complaint=str(self.record.chief_complaint.value or ""),
#                     interview_qa=self.record.conversation_history,
#                     priority_flag=has_red_flags,
#                     status="IN_PROGRESS"
#                 )
code = code.replace('''database.commit_fsm_checkpoint(
                    session_id=self.record.session_id,
                    filled_state=record_payload,
                    chief_complaint=str(self.record.chief_complaint.value or ""),
                    interview_qa=self.record.conversation_history,
                    priority_flag=has_red_flags,
                    status="IN_PROGRESS"
                )''', '''asyncio.run_coroutine_threadsafe(
                    database.commit_fsm_checkpoint(
                        session_id=self.record.session_id,
                        filled_state=record_payload,
                        chief_complaint=str(self.record.chief_complaint.value or ""),
                        interview_qa=self.record.conversation_history,
                        priority_flag=has_red_flags,
                        status="IN_PROGRESS"
                    ),
                    asyncio.get_event_loop()
                )''')

# Occurrence 4: (Same as 3)

# Occurrence 5:
#             database.commit_fsm_checkpoint(
#                 session_id=self.record.session_id,
#                 filled_state=record_payload,
#                 chief_complaint=str(self.record.chief_complaint.value or ""),
#                 interview_qa=self.record.conversation_history,
#                 priority_flag=has_red_flags,
#                 status="WAITING"
#             )
code = code.replace('''database.commit_fsm_checkpoint(
                session_id=self.record.session_id,
                filled_state=record_payload,
                chief_complaint=str(self.record.chief_complaint.value or ""),
                interview_qa=self.record.conversation_history,
                priority_flag=has_red_flags,
                status="WAITING"
            )''', '''asyncio.run_coroutine_threadsafe(
                database.commit_fsm_checkpoint(
                    session_id=self.record.session_id,
                    filled_state=record_payload,
                    chief_complaint=str(self.record.chief_complaint.value or ""),
                    interview_qa=self.record.conversation_history,
                    priority_flag=has_red_flags,
                    status="WAITING"
                ),
                asyncio.get_event_loop()
            )''')

if 'import asyncio' not in code:
    code = 'import asyncio\n' + code

with open('dialogue_manager.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Finished safe refactoring of dialogue_manager.py")
