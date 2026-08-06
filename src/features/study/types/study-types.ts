export interface StudyCard {
  id: string;
  front: string;
  back: string;
  setId: string;
  setName: string;
}

export interface StudySourceRow {
  id: string;
  front: string;
  back: string;
  set_id: string;
  position: number;
  flashcard_sets: { name: string };
}

export interface StudyCollectionOption {
  id: string;
  name: string;
}

export interface StudySourceParams {
  all: boolean;
  setIds: string[];
  collectionIds: string[];
}

export interface StudySessionParams extends StudySourceParams {
  seed?: number;
}
