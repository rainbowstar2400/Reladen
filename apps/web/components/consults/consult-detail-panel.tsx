type Line   = { speaker: string; text: string }
type Choice = { id: string; label: string }

export type ConsultDetail = {
  id: string
  title: string
  date: string
  weekday: string
  time: string
  prompt: Line
  choices: Choice[]
  replyByChoice?: Record<string, string>
  systemAfter?: string[]
  selectedChoiceId?: string | null
}
