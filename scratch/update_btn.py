index_path = r'C:/Users/user/.gemini/antigravity/scratch/smart-clinic-frontend/index.source.html'
with open(index_path, 'r', encoding='utf-8') as f:
    c = f.read()

target = '''                    <button
                      type="button"
                      onClick={handleUnifiedCompleteConsultation}
                      className="w-full sm:w-auto px-7 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black text-sm shadow-xl shadow-teal-500/25 flex items-center justify-center space-x-2 transition cursor-pointer transform active:scale-95"
                      title="Save prescription, mark completed, dispatch WhatsApp Rx, and auto-move next patient into room"
                    >
                      <span className="text-base">✅</span>
                      <span>Complete Consultation</span>
                    </button>'''

replacement = '''                    <button
                      type="button"
                      onClick={handleUnifiedCompleteConsultation}
                      className="w-full sm:w-auto px-7 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black text-sm shadow-xl shadow-teal-500/25 flex items-center justify-center space-x-2 transition cursor-pointer transform active:scale-95"
                      title="Save prescription, generate digital PDF, auto-dispatch to patient WhatsApp in under 10 seconds, and call next token"
                    >
                      <span className="text-base">⚡</span>
                      <span>Save / Finish Prescription (WhatsApp Rx ⚡)</span>
                    </button>'''

c_norm = c.replace('\r\n', '\n')
target_norm = target.replace('\r\n', '\n')
replacement_norm = replacement.replace('\r\n', '\n')

if target_norm in c_norm:
    c_norm = c_norm.replace(target_norm, replacement_norm)
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(c_norm)
    print('Button successfully updated to Save / Finish Prescription (WhatsApp Rx ⚡)!')
else:
    print('Target not found!')
