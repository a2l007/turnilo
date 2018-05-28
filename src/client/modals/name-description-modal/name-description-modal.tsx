/*
 * Copyright 2015-2016 Imply Data, Inc.
 * Copyright 2017-2018 Allegro.pl
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import "./name-description-modal.scss";

import * as React from "react";

import { classNames } from "../../utils/dom/dom";
import { ImmutableFormDelegate, ImmutableFormState } from "../../utils/immutable-form-delegate/immutable-form-delegate";

import { Button, FormLabel, ImmutableInput, Modal } from "../../components/index";

import { COLLECTION as LABELS } from "../../../common/models/labels";

export interface NameDescriptionModalProps<T> extends React.Props<any> {
  onCancel?: () => void;
  onSave?: (newItem: T) => void;
  item: T;
  title: string;
  okTitle: string;
}

export class NameDescriptionModal<T> extends React.Component<NameDescriptionModalProps<T>, ImmutableFormState<T>> {

  static specialize<U>() {
    return NameDescriptionModal as { new (props: NameDescriptionModalProps<U>): NameDescriptionModal<U>; };
  }

  private delegate: ImmutableFormDelegate<T>;

  constructor(props: NameDescriptionModalProps<T>) {
    super(props);

    this.delegate = new ImmutableFormDelegate(this);
  }

  initFromProps(props: NameDescriptionModalProps<T>) {
    if (!props.item) return;

    this.setState({
      canSave: true,
      newInstance: props.item
    });
  }

  componentDidMount() {
    this.initFromProps(this.props);
  }

  save() {
    if (this.state.canSave) this.props.onSave(this.state.newInstance);
  }

  render(): JSX.Element {
    const { title, okTitle } = this.props;
    const { canSave, errors, newInstance } = this.state;

    if (!newInstance) return null;

    var makeLabel = FormLabel.simpleGenerator(LABELS, errors, true);
    var makeTextInput = ImmutableInput.simpleGenerator(newInstance, this.delegate.onChange);

    return <Modal
      className="name-description-modal"
      title={title}
      onClose={this.props.onCancel}
      onEnter={this.save.bind(this)}
    >
      <form className="general vertical">
        {makeLabel("title")}
        {makeTextInput("title", /.*/, true)}

        {makeLabel("description")}
        {makeTextInput("description", /.*/)}

      </form>

      <div className="button-bar">
        <Button
          className={classNames("save", { disabled: !canSave })}
          title={okTitle}
          type="primary"
          onClick={this.save.bind(this)}
        />
        <Button className="cancel" title="Cancel" type="secondary" onClick={this.props.onCancel}/>
      </div>

    </Modal>;
  }
}
