with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

target = '                                  \U0001f511\n                                </button>'

delete_btn = '''                                  \U0001f511
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setClinicToDelete(clinic)}
                                  className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-500/50 text-xs font-bold rounded-lg transition cursor-pointer flex items-center space-x-1"
                                  title={`Permanently delete ${clinic.name} and wipe all tenant data`}
                                >
                                  <span>\U0001f5d1\ufe0f</span>
                                  <span className="hidden sm:inline">Delete</span>
                                </button>'''

if target in text:
    text = text.replace(target, delete_btn, 1)
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print("SUCCESS: Inserted Delete button into ACTIONS column in index.html")
else:
    print("ERROR: Target key button not found")
